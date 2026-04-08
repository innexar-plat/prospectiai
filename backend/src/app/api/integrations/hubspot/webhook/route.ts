import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptEmailSecret } from '@/lib/email-config-encrypt';
import { logger } from '@/lib/logger';

type HubspotWebhookEvent = {
  eventId?: string;
  subscriptionType?: string;
  objectId?: number;
  objectType?: string;
  propertyName?: string;
  propertyValue?: string;
  occurredAt?: number;
  attemptNumber?: number;
};

function getAppBaseUrl(): string {
  const base = process.env.AUTH_URL ?? process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

async function getHubspotWebhookSecret(): Promise<string> {
  const prismaWithCrm = prisma as typeof prisma & {
    crmIntegrationConfig: {
      findUnique: (args: { where: { provider: string } }) => Promise<{ clientSecretEncrypted: string } | null>;
    };
  };

  const dbConfig = await prismaWithCrm.crmIntegrationConfig.findUnique({ where: { provider: 'hubspot' } }).catch(() => null);
  const secretFromDb = dbConfig?.clientSecretEncrypted
    ? decryptEmailSecret(dbConfig.clientSecretEncrypted).trim()
    : '';

  if (secretFromDb) return secretFromDb;
  return process.env.HUBSPOT_CLIENT_SECRET?.trim() ?? '';
}

function safeCompareBase64(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf8');
    const bBuf = Buffer.from(b, 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function buildCandidateUris(req: Request): string[] {
  const incoming = new URL(req.url);
  const canonical = `${getAppBaseUrl()}${incoming.pathname}${incoming.search}`;
  return [req.url, canonical];
}

function computeSignatureV3(secret: string, method: string, uri: string, body: string, timestamp: string): string {
  const source = `${method}${uri}${body}${timestamp}`;
  return createHmac('sha256', secret).update(source, 'utf8').digest('base64');
}

async function validateHubspotSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get('x-hubspot-signature-v3')?.trim() ?? '';
  const timestamp = req.headers.get('x-hubspot-request-timestamp')?.trim() ?? '';

  if (!signature || !timestamp) return false;

  const timestampMs = Number(timestamp);
  if (Number.isNaN(timestampMs)) return false;

  // Reject old/replayed requests outside a 5-minute window.
  const maxSkewMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > maxSkewMs) return false;

  const secret = await getHubspotWebhookSecret();
  if (!secret) {
    logger.warn('HubSpot webhook secret missing (HUBSPOT_CLIENT_SECRET or admin CRM config)');
    return false;
  }

  const method = req.method.toUpperCase();
  const uris = buildCandidateUris(req);

  for (const uri of uris) {
    const expected = computeSignatureV3(secret, method, uri, rawBody, timestamp);
    if (safeCompareBase64(expected, signature)) return true;
  }

  return false;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const isValid = await validateHubspotSignature(req, rawBody);
  if (!isValid) {
    logger.warn('HubSpot webhook signature validation failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let events: HubspotWebhookEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    events = Array.isArray(parsed) ? (parsed as HubspotWebhookEvent[]) : [parsed as HubspotWebhookEvent];
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  for (const ev of events) {
    logger.info('HubSpot webhook event', {
      eventId: ev.eventId,
      subscriptionType: ev.subscriptionType,
      objectType: ev.objectType,
      objectId: ev.objectId,
      propertyName: ev.propertyName,
      attemptNumber: ev.attemptNumber,
      occurredAt: ev.occurredAt,
    });
  }

  return NextResponse.json({ received: true, count: events.length });
}
