import { createHmac, randomBytes } from 'crypto';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { prisma } from '@/lib/prisma';

type HubspotTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type HubspotUserRecord = {
  id: string;
  hubspotToken?: string | null;
  hubspotRefreshToken?: string | null;
  hubspotTokenExpiresAt?: Date | null;
};

function getAppBaseUrl(): string {
  const base = process.env.AUTH_URL ?? process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export function getHubspotOauthCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/integrations/hubspot/oauth/callback`;
}

async function getHubspotOauthConfig() {
  const prismaWithCrm = prisma as typeof prisma & {
    crmIntegrationConfig: {
      findUnique: (args: { where: { provider: string } }) => Promise<{ clientId: string; clientSecretEncrypted: string } | null>;
    };
  };
  const dbConfig = await prismaWithCrm.crmIntegrationConfig.findUnique({ where: { provider: 'hubspot' } }).catch(() => null);
  const clientIdFromDb = dbConfig?.clientId?.trim();
  const clientSecretFromDb = dbConfig?.clientSecretEncrypted
    ? decryptEmailSecret(dbConfig.clientSecretEncrypted).trim()
    : '';

  if (clientIdFromDb && clientSecretFromDb) {
    return { clientId: clientIdFromDb, clientSecret: clientSecretFromDb };
  }

  const clientId = process.env.HUBSPOT_CLIENT_ID?.trim();
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('HubSpot OAuth não configurado. Defina o app no painel admin ou nas variáveis HUBSPOT_CLIENT_ID e HUBSPOT_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

function getStateSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET não configurado para assinar state OAuth.');
  }
  return secret;
}

function signState(payloadB64: string): string {
  return createHmac('sha256', getStateSecret()).update(payloadB64).digest('base64url');
}

export function createHubspotOauthState(userId: string): string {
  const payload = {
    uid: userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signState(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyHubspotOauthState(state: string): { userId: string } {
  const [payloadB64, sig] = state.split('.');
  if (!payloadB64 || !sig) throw new Error('State inválido.');

  const expected = signState(payloadB64);
  if (sig !== expected) throw new Error('State inválido (assinatura).');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { uid?: string; ts?: number };
  if (!payload.uid || !payload.ts) throw new Error('State inválido (payload).');

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - payload.ts > maxAgeMs) throw new Error('State expirado.');

  return { userId: payload.uid };
}

export async function buildHubspotOauthAuthorizeUrl(state: string): Promise<string> {
  const { clientId } = await getHubspotOauthConfig();
  const callback = getHubspotOauthCallbackUrl();
  const url = new URL('https://app.hubspot.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('scope', 'crm.objects.contacts.write crm.objects.contacts.read crm.objects.deals.write crm.objects.deals.read crm.schemas.deals.read oauth');
  url.searchParams.set('state', state);
  return url.toString();
}

async function requestTokens(form: URLSearchParams): Promise<HubspotTokenResponse> {
  const res = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : `HubSpot token endpoint retornou ${res.status}`;
    throw new Error(msg);
  }

  const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
  if (!accessToken) throw new Error('Resposta OAuth inválida (sem access_token).');

  return {
    access_token: accessToken,
    refresh_token: typeof body.refresh_token === 'string' ? body.refresh_token : undefined,
    expires_in: typeof body.expires_in === 'number' ? body.expires_in : undefined,
  };
}

export async function exchangeHubspotCodeForTokens(code: string): Promise<HubspotTokenResponse> {
  const { clientId, clientSecret } = await getHubspotOauthConfig();
  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('redirect_uri', getHubspotOauthCallbackUrl());
  form.set('code', code);
  return requestTokens(form);
}

async function refreshHubspotTokens(refreshToken: string): Promise<HubspotTokenResponse> {
  const { clientId, clientSecret } = await getHubspotOauthConfig();
  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('refresh_token', refreshToken);
  return requestTokens(form);
}

function expiresAtFromNow(expiresIn?: number): Date | null {
  if (!expiresIn || Number.isNaN(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function saveUserHubspotTokens(userId: string, tokenData: HubspotTokenResponse) {
  const data: Record<string, unknown> = {
    hubspotToken: tokenData.access_token,
    hubspotTokenExpiresAt: expiresAtFromNow(tokenData.expires_in),
  };
  if (tokenData.refresh_token) data.hubspotRefreshToken = tokenData.refresh_token;

  await prisma.user.update({
    where: { id: userId },
    data: data as never,
  });
}

function isExpiringSoon(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  const nowPlus5Min = Date.now() + 5 * 60 * 1000;
  return expiresAt.getTime() <= nowPlus5Min;
}

export async function getValidHubspotAccessToken(userId: string): Promise<string | null> {
  const userRaw = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRaw) return null;

  const user = userRaw as HubspotUserRecord;
  if (!user.hubspotToken) return null;

  if (!isExpiringSoon(user.hubspotTokenExpiresAt)) {
    return user.hubspotToken;
  }

  if (!user.hubspotRefreshToken) {
    return user.hubspotToken;
  }

  // Use optimistic locking: re-read and check if another request already refreshed
  const freshUser = await prisma.user.findUnique({ where: { id: userId } }) as HubspotUserRecord | null;
  if (freshUser?.hubspotTokenExpiresAt && !isExpiringSoon(freshUser.hubspotTokenExpiresAt)) {
    return freshUser.hubspotToken ?? null;
  }

  try {
    const refreshed = await refreshHubspotTokens(user.hubspotRefreshToken);
    await saveUserHubspotTokens(userId, refreshed);
    return refreshed.access_token;
  } catch (err) {
    // If refresh fails (e.g. concurrent refresh invalidated the token), return current token
    const { logger } = await import('@/lib/logger');
    logger.warn('HubSpot token refresh failed, using current token', {
      userId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return user.hubspotToken;
  }
}

export async function forceRefreshHubspotTokenIfPossible(userId: string): Promise<string | null> {
  const userRaw = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRaw) return null;

  const user = userRaw as HubspotUserRecord;
  if (!user.hubspotRefreshToken) return user.hubspotToken ?? null;

  const refreshed = await refreshHubspotTokens(user.hubspotRefreshToken);
  await saveUserHubspotTokens(userId, refreshed);
  return refreshed.access_token;
}

export async function saveOAuthHubspotTokens(userId: string, tokens: HubspotTokenResponse) {
  await saveUserHubspotTokens(userId, tokens);
}

export async function clearHubspotIntegration(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      hubspotToken: null,
      hubspotRefreshToken: null,
      hubspotTokenExpiresAt: null,
    } as never,
  });
}
