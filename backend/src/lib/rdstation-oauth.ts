import { createHmac, randomBytes } from 'crypto';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { prisma } from '@/lib/prisma';

type RdTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type RdProductMode = 'crm' | 'marketing';

type RdUserRecord = {
  id: string;
  rdStationToken?: string | null;
  rdStationRefreshToken?: string | null;
  rdStationTokenExpiresAt?: Date | null;
};

function getAppBaseUrl(): string {
  const base = process.env.AUTH_URL ?? process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export function getRdProductMode(): RdProductMode {
  const configured = (process.env.RD_STATION_PRODUCT ?? '').trim().toLowerCase();
  return configured === 'marketing' ? 'marketing' : 'crm';
}

function getRdAuthorizeEndpoint(): string {
  // CRM v2 docs use the same OAuth authorize endpoint via accounts.rdstation.com.
  return 'https://accounts.rdstation.com/oauth/authorize';
}

function getRdTokenEndpoint(): string {
  // CRM v2 docs use the shared OAuth2 token endpoint.
  return 'https://api.rd.services/oauth2/token';
}

export function getRdProbeContactsUrl(): string {
  return getRdProductMode() === 'marketing'
    ? 'https://api.rd.services/platform/contacts?page=1&page_size=1'
    : 'https://api.rd.services/crm/v2/contacts?page[number]=1&page[size]=1';
}

export function getRdSendLeadUrl(): string {
  return getRdProductMode() === 'marketing'
    ? 'https://api.rd.services/platform/events'
    : 'https://api.rd.services/crm/v2/contacts';
}

export function getRdOauthCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/integrations/rdstation/oauth/callback`;
}

async function getRdOauthConfig() {
  const prismaWithCrm = prisma as typeof prisma & {
    crmIntegrationConfig: {
      findUnique: (args: { where: { provider: string } }) => Promise<{ clientId: string; clientSecretEncrypted: string } | null>;
    };
  };
  const dbConfig = await prismaWithCrm.crmIntegrationConfig.findUnique({ where: { provider: 'rdstation' } }).catch(() => null);
  const clientIdFromDb = dbConfig?.clientId?.trim();
  const clientSecretFromDb = dbConfig?.clientSecretEncrypted
    ? decryptEmailSecret(dbConfig.clientSecretEncrypted).trim()
    : '';

  if (clientIdFromDb && clientSecretFromDb) {
    return { clientId: clientIdFromDb, clientSecret: clientSecretFromDb };
  }

  const clientId = process.env.RD_STATION_CLIENT_ID?.trim();
  const clientSecret = process.env.RD_STATION_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('RD OAuth não configurado. Defina o app no painel admin ou nas variáveis RD_STATION_CLIENT_ID e RD_STATION_CLIENT_SECRET.');
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

export function createRdOauthState(userId: string): string {
  const payload = {
    uid: userId,
    ts: Date.now(),
    nonce: randomBytes(8).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signState(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyRdOauthState(state: string): { userId: string } {
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

export async function buildRdOauthAuthorizeUrl(state: string): Promise<string> {
  const { clientId } = await getRdOauthConfig();
  const callback = getRdOauthCallbackUrl();
  const url = new URL(getRdAuthorizeEndpoint());
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

async function requestTokens(form: URLSearchParams): Promise<RdTokenResponse> {
  const res = await fetch(getRdTokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof body.error_description === 'string'
      ? body.error_description
      : typeof body.error === 'string'
        ? body.error
        : `RD token endpoint retornou ${res.status}`;
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

export async function exchangeRdCodeForTokens(code: string): Promise<RdTokenResponse> {
  const { clientId, clientSecret } = await getRdOauthConfig();
  const form = new URLSearchParams();
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('code', code);
  form.set('redirect_uri', getRdOauthCallbackUrl());
  form.set('grant_type', 'authorization_code');
  return requestTokens(form);
}

export async function refreshRdTokens(refreshToken: string): Promise<RdTokenResponse> {
  const { clientId, clientSecret } = await getRdOauthConfig();
  const form = new URLSearchParams();
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('refresh_token', refreshToken);
  form.set('grant_type', 'refresh_token');
  return requestTokens(form);
}

function expiresAtFromNow(expiresIn?: number): Date | null {
  if (!expiresIn || Number.isNaN(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

async function saveUserRdTokens(userId: string, tokenData: RdTokenResponse) {
  const data: Record<string, unknown> = {
    rdStationToken: tokenData.access_token,
    rdStationTokenExpiresAt: expiresAtFromNow(tokenData.expires_in),
  };
  if (tokenData.refresh_token) data.rdStationRefreshToken = tokenData.refresh_token;

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

export async function getValidRdStationAccessToken(userId: string): Promise<string | null> {
  const userRaw = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRaw) return null;

  const user = userRaw as unknown as RdUserRecord;
  if (!user.rdStationToken) return null;

  if (!isExpiringSoon(user.rdStationTokenExpiresAt)) {
    return user.rdStationToken;
  }

  if (!user.rdStationRefreshToken) {
    return user.rdStationToken;
  }

  // Use optimistic locking: re-read and check if another request already refreshed
  const freshUser = await prisma.user.findUnique({ where: { id: userId } }) as unknown as RdUserRecord | null;
  if (freshUser?.rdStationTokenExpiresAt && !isExpiringSoon(freshUser.rdStationTokenExpiresAt)) {
    return freshUser.rdStationToken ?? null;
  }

  try {
    const refreshed = await refreshRdTokens(user.rdStationRefreshToken);
    await saveUserRdTokens(userId, refreshed);
    return refreshed.access_token;
  } catch (err) {
    // If refresh fails (e.g. concurrent refresh invalidated the token), return current token
    const { logger } = await import('@/lib/logger');
    logger.warn('RD Station token refresh failed, using current token', {
      userId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return user.rdStationToken;
  }
}

export async function forceRefreshRdTokenIfPossible(userId: string): Promise<string | null> {
  const userRaw = await prisma.user.findUnique({ where: { id: userId } });
  if (!userRaw) return null;

  const user = userRaw as unknown as RdUserRecord;
  if (!user.rdStationRefreshToken) return user.rdStationToken ?? null;

  try {
    const refreshed = await refreshRdTokens(user.rdStationRefreshToken);
    await saveUserRdTokens(userId, refreshed);
    return refreshed.access_token;
  } catch (err) {
    const { logger } = await import('@/lib/logger');
    logger.warn('RD Station force refresh failed', {
      userId,
      error: err instanceof Error ? err.message : 'Unknown',
    });
    return user.rdStationToken ?? null;
  }
}

export async function saveManualRdToken(userId: string, token: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      rdStationToken: token,
      rdStationRefreshToken: null,
      rdStationTokenExpiresAt: null,
    } as never,
  });
}

export async function saveOAuthRdTokens(userId: string, tokens: RdTokenResponse) {
  await saveUserRdTokens(userId, tokens);
}

export async function clearRdIntegration(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      rdStationToken: null,
      rdStationRefreshToken: null,
      rdStationTokenExpiresAt: null,
    } as never,
  });
}
