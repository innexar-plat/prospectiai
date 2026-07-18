/**
 * Provider-picking send: routes to Evolution or Meta depending on how the owner (rep or
 * admin config) is connected, then records the outgoing message in the shared chat log.
 */
import { sendText as sendEvolutionText } from '@/lib/evolution';
import { sendMetaText } from '@/lib/whatsapp-meta';
import { recordOutgoingMessage, type ChatOwner } from '@/lib/whatsapp-chat';

export type WhatsAppSendableOwner = {
    provider: string;
    evolutionInstanceName: string | null;
    metaPhoneNumberId: string | null;
    whatsappStatus: string;
};

export type SendChatMessageResult =
    | { ok: true; conversationId: string; messageId: string }
    | { ok: false; error: string; outsideWindow?: boolean };

export async function sendChatMessage(
    owner: WhatsAppSendableOwner,
    chatOwner: ChatOwner,
    contactNumber: string,
    text: string,
): Promise<SendChatMessageResult> {
    if (owner.whatsappStatus !== 'CONNECTED') {
        return { ok: false, error: 'WhatsApp not connected' };
    }

    if (owner.provider === 'META') {
        if (!owner.metaPhoneNumberId) return { ok: false, error: 'Meta phone number not configured' };
        const result = await sendMetaText(owner.metaPhoneNumberId, contactNumber, text);
        if (!result.ok) return { ok: false, error: result.error, outsideWindow: result.outsideWindow };
        const { conversationId, messageId } = await recordOutgoingMessage({
            owner: chatOwner,
            contactNumber,
            provider: 'META',
            providerMessageId: result.providerMessageId,
            body: text,
        });
        return { ok: true, conversationId, messageId };
    }

    if (!owner.evolutionInstanceName) return { ok: false, error: 'Evolution instance not configured' };
    try {
        await sendEvolutionText(owner.evolutionInstanceName, contactNumber, text);
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
    const { conversationId, messageId } = await recordOutgoingMessage({
        owner: chatOwner,
        contactNumber,
        provider: 'EVOLUTION',
        body: text,
    });
    return { ok: true, conversationId, messageId };
}
