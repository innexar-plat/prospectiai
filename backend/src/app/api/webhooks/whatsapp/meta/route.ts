import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { isWebhookDuplicate } from '@/lib/webhook-dedup';
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature, parseMetaWebhookPayload, type MetaStatusUpdate } from '@/lib/whatsapp-meta';
import { recordIncomingMessage, updateMessageStatusByProviderId, type ChatOwner } from '@/lib/whatsapp-chat';
import { createHash } from 'crypto';

/**
 * Single, account-wide receiver for the WhatsApp Cloud API (registered once in the Meta App
 * dashboard) — every phone number under the company's WABA sends events here. We route each
 * event to its owner (a Representative or the AdminWhatsAppConfig) by phone_number_id.
 */
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (!verifyMetaWebhookChallenge(mode, token) || !challenge) {
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

async function resolveOwner(phoneNumberId: string): Promise<ChatOwner | null> {
  const rep = await prisma.representative.findUnique({ where: { metaPhoneNumberId: phoneNumberId }, select: { id: true } });
  if (rep) return { representativeId: rep.id };

  const admin = await prisma.adminWhatsAppConfig.findUnique({ where: { metaPhoneNumberId: phoneNumberId }, select: { id: true } });
  if (admin) return { adminConfigId: admin.id };

  return null;
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit('webhook:whatsapp-meta', 120, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const rawBody = await req.text();
  if (!verifyMetaWebhookSignature(rawBody, req.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventId = createHash('sha1').update(rawBody).digest('hex');
  if (await isWebhookDuplicate('whatsapp-meta', eventId)) {
    return NextResponse.json({ received: true });
  }

  const payload = JSON.parse(rawBody || '{}');
  const { messages, statuses } = parseMetaWebhookPayload(payload);

  for (const message of messages) {
    const owner = await resolveOwner(message.phoneNumberId);
    if (!owner) continue;
    await recordIncomingMessage({
      owner,
      contactNumber: message.from,
      contactName: message.contactName,
      provider: 'META',
      providerMessageId: message.providerMessageId,
      body: message.body,
    });
  }

  const statusMap: Record<MetaStatusUpdate['status'], 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
    sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED',
  };
  for (const status of statuses) {
    await updateMessageStatusByProviderId('META', status.providerMessageId, statusMap[status.status]);
  }

  return NextResponse.json({ received: true });
}
