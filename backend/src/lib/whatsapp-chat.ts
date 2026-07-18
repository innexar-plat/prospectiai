/**
 * Provider-agnostic persistence for WhatsApp conversations/messages. Both the Evolution
 * webhook and the Meta Cloud API webhook normalize their events into these same calls,
 * so the chat UI and REST endpoints never need to know which provider is behind a conversation.
 */
import { prisma } from '@/lib/prisma';

export type ChatOwner = { representativeId: string } | { adminConfigId: string };

function ownerWhere(owner: ChatOwner) {
    return 'representativeId' in owner
        ? { representativeId: owner.representativeId }
        : { adminConfigId: owner.adminConfigId };
}

const PREVIEW_MAX_LENGTH = 140;

function truncatePreview(body: string): string {
    return body.length > PREVIEW_MAX_LENGTH ? `${body.slice(0, PREVIEW_MAX_LENGTH)}…` : body;
}

function normalizeDigits(value: string): string {
    return value.replace(/\D/g, '');
}

/** Best-effort match to an existing RepClient by phone number (digits-only suffix comparison). */
async function findMatchingRepClientId(representativeId: string, contactNumber: string): Promise<string | null> {
    const digits = normalizeDigits(contactNumber);
    if (digits.length < 8) return null;
    const candidates = await prisma.repClient.findMany({
        where: { representativeId, phone: { not: null } },
        select: { id: true, phone: true },
    });
    const suffix = digits.slice(-8);
    const match = candidates.find((c) => c.phone && normalizeDigits(c.phone).endsWith(suffix));
    return match?.id ?? null;
}

async function getOrCreateConversation(
    owner: ChatOwner,
    contactNumber: string,
    contactName: string | null,
): Promise<{ id: string; unreadCount: number }> {
    const where = { ...ownerWhere(owner), contactNumber };
    const existing = await prisma.whatsAppConversation.findFirst({ where, select: { id: true, unreadCount: true, contactName: true } });
    if (existing) {
        if (contactName && !existing.contactName) {
            await prisma.whatsAppConversation.update({ where: { id: existing.id }, data: { contactName } });
        }
        return existing;
    }

    const repClientId = 'representativeId' in owner
        ? await findMatchingRepClientId(owner.representativeId, contactNumber)
        : null;

    const created = await prisma.whatsAppConversation.create({
        data: {
            ...ownerWhere(owner),
            contactNumber,
            contactName,
            repClientId,
        },
        select: { id: true, unreadCount: true },
    });
    return created;
}

export async function recordIncomingMessage(params: {
    owner: ChatOwner;
    contactNumber: string;
    contactName: string | null;
    provider: 'EVOLUTION' | 'META';
    providerMessageId?: string;
    body: string;
}): Promise<void> {
    const conversation = await getOrCreateConversation(params.owner, params.contactNumber, params.contactName);

    await prisma.$transaction([
        prisma.whatsAppMessage.create({
            data: {
                conversationId: conversation.id,
                direction: 'IN',
                provider: params.provider,
                providerMessageId: params.providerMessageId,
                body: params.body,
                status: 'DELIVERED',
            },
        }),
        prisma.whatsAppConversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: new Date(),
                lastMessagePreview: truncatePreview(params.body),
                unreadCount: { increment: 1 },
            },
        }),
    ]);
}

export async function recordOutgoingMessage(params: {
    owner: ChatOwner;
    contactNumber: string;
    provider: 'EVOLUTION' | 'META';
    providerMessageId?: string;
    body: string;
}): Promise<{ conversationId: string; messageId: string }> {
    const conversation = await getOrCreateConversation(params.owner, params.contactNumber, null);

    const message = await prisma.whatsAppMessage.create({
        data: {
            conversationId: conversation.id,
            direction: 'OUT',
            provider: params.provider,
            providerMessageId: params.providerMessageId,
            body: params.body,
            status: 'SENT',
        },
    });

    await prisma.whatsAppConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: truncatePreview(params.body) },
    });

    return { conversationId: conversation.id, messageId: message.id };
}

export async function updateMessageStatusByProviderId(
    provider: 'EVOLUTION' | 'META',
    providerMessageId: string,
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
): Promise<void> {
    await prisma.whatsAppMessage.updateMany({
        where: { provider, providerMessageId },
        data: { status },
    });
}

export async function markConversationRead(conversationId: string, owner: ChatOwner): Promise<boolean> {
    const result = await prisma.whatsAppConversation.updateMany({
        where: { id: conversationId, ...ownerWhere(owner) },
        data: { unreadCount: 0 },
    });
    return result.count > 0;
}
