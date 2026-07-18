import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { isWebhookDuplicate } from '@/lib/webhook-dedup';
import { parseEvolutionIncomingMessage } from '@/lib/evolution';
import { recordIncomingMessage, type ChatOwner } from '@/lib/whatsapp-chat';

type EvolutionOwner = { kind: 'rep'; id: string } | { kind: 'admin'; id: string };

async function resolveOwner(instanceName: string): Promise<EvolutionOwner | null> {
  const rep = await prisma.representative.findUnique({ where: { evolutionInstanceName: instanceName }, select: { id: true } });
  if (rep) return { kind: 'rep', id: rep.id };

  const admin = await prisma.adminWhatsAppConfig.findUnique({ where: { evolutionInstanceName: instanceName }, select: { id: true } });
  if (admin) return { kind: 'admin', id: admin.id };

  return null;
}

function chatOwnerFor(owner: EvolutionOwner): ChatOwner {
  return owner.kind === 'rep' ? { representativeId: owner.id } : { adminConfigId: owner.id };
}

async function updateOwnerStatus(owner: EvolutionOwner, data: Record<string, unknown>): Promise<void> {
  if (owner.kind === 'rep') {
    await prisma.representative.update({ where: { id: owner.id }, data });
  } else {
    await prisma.adminWhatsAppConfig.update({ where: { id: owner.id }, data });
  }
}

/**
 * Shared receiver for Evolution API events — serves both representative and admin instances
 * (registered per-instance in evolution.ts#configureWebhook). Handles two event shapes (both
 * keyed by `instance`, not `event`, in this Evolution version):
 * - Connection status: { instance, data: { state: 'open'|'close'|'connecting', number? } }
 * - Incoming message:  { instance, data: { key: { remoteJid, fromMe, id }, message, pushName } }
 */
export async function POST(req: NextRequest) {
  const rl = await rateLimit('webhook:evolution', 120, 60);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get('token');
  if (!process.env.EVOLUTION_WEBHOOK_TOKEN || token !== process.env.EVOLUTION_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const rawBody = await req.text();
  const eventId = createHash('sha1').update(rawBody).digest('hex');
  if (await isWebhookDuplicate('evolution', eventId)) {
    return NextResponse.json({ received: true });
  }

  const payload = JSON.parse(rawBody || '{}') as { event?: string; instance?: string; data?: { state?: string; number?: string } };
  const instanceName = payload.instance;
  if (!instanceName) return NextResponse.json({ received: true });

  const owner = await resolveOwner(instanceName);
  if (!owner) return NextResponse.json({ received: true });

  const state = payload.data?.state;
  if (state === 'open') {
    await updateOwnerStatus(owner, {
      whatsappStatus: 'CONNECTED',
      whatsappConnectedAt: new Date(),
      whatsappNumber: payload.data?.number,
    });
  } else if (state === 'close') {
    await updateOwnerStatus(owner, { whatsappStatus: 'DISCONNECTED', whatsappNumber: null });
  } else if (state === 'connecting') {
    await updateOwnerStatus(owner, { whatsappStatus: 'CONNECTING' });
  } else {
    const incoming = parseEvolutionIncomingMessage(payload);
    if (incoming) {
      await recordIncomingMessage({
        owner: chatOwnerFor(owner),
        contactNumber: incoming.from,
        contactName: incoming.contactName,
        provider: 'EVOLUTION',
        providerMessageId: incoming.providerMessageId,
        body: incoming.body,
      });
    }
  }

  return NextResponse.json({ received: true });
}
