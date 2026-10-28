/**
 * Cadence: the 2nd, 3rd… WhatsApp message for a lead already contacted. Each touch uses a
 * different angle (bump → proof → breakup) and is generated once, then cached in
 * LeadAnalysis.extras.followUpMessages — re-opening the same touch costs no tokens.
 */
import { prisma } from '@/lib/prisma';
import { generateCompletionForRole } from '@/lib/ai/resolve';
import { recordUsageEvent } from '@/lib/usage';
import { logger } from '@/lib/logger';

const MAX_MESSAGE_CHARS = 600;

const ANGLES_PT: Record<number, string> = {
    2: 'Retomada curta e leve: lembre do contato anterior em 1 frase e traga UM benefício concreto e novo (não repita a 1ª mensagem). Termine com uma pergunta simples de sim/não.',
    3: 'Prova: cite um resultado típico que empresas do mesmo nicho conseguem com a solução (sem inventar nomes de clientes nem números exatos). Ofereça algo de baixo compromisso (ex.: mostrar em 10 minutos).',
};
const BREAKUP_PT = 'Último contato, respeitoso: diga que não vai mais insistir, deixe a porta aberta e pergunte se faz sentido falar em outro momento ou com outra pessoa.';

const ANGLES_EN: Record<number, string> = {
    2: 'Short, light bump: reference the previous message in 1 sentence and add ONE new concrete benefit (do not repeat the first message). End with a simple yes/no question.',
    3: 'Proof: mention a typical result businesses in the same niche get from the solution (no invented client names or exact numbers). Offer something low-commitment (e.g. a 10-minute walkthrough).',
};
const BREAKUP_EN = 'Respectful last touch: say you will stop following up, leave the door open and ask whether another time or another person makes more sense.';

export function angleForTouch(touch: number, en: boolean): string {
    const angles = en ? ANGLES_EN : ANGLES_PT;
    return angles[touch] ?? (en ? BREAKUP_EN : BREAKUP_PT);
}

type Extras = Record<string, unknown> & { followUpMessages?: Record<string, string> };

export function buildFollowUpPrompt(p: {
    en: boolean;
    touch: number;
    leadName: string;
    niche: string | null;
    previousMessage: string | null;
    seller: { companyName?: string | null; productService?: string | null; mainBenefit?: string | null } | null;
}): string {
    const seller = p.seller?.productService
        ? `${p.seller.companyName || (p.en ? 'Our company' : 'Nossa empresa')} — ${p.en ? 'sells' : 'vende'}: ${p.seller.productService}${p.seller.mainBenefit ? `; ${p.en ? 'differentiator' : 'diferencial'}: ${p.seller.mainBenefit}` : ''}`
        : (p.en ? 'Seller profile not provided — keep the offer generic.' : 'Perfil do vendedor não informado — mantenha a oferta genérica.');
    const prev = p.previousMessage ? p.previousMessage.slice(0, 500) : (p.en ? '(not available)' : '(não disponível)');
    return p.en
        ? `Write WhatsApp follow-up message #${p.touch} to "${p.leadName}"${p.niche ? ` (${p.niche})` : ''}. They did not reply yet.
Seller: ${seller}
Previous message sent: ${prev}
Angle: ${angleForTouch(p.touch, true)}
Rules: max 3 short sentences, natural and human, no greeting like "Dear", no emojis spam (max 1), no links, no placeholders like [Name]. Output only the message text.`
        : `Escreva a mensagem de follow-up nº ${p.touch} pelo WhatsApp para "${p.leadName}"${p.niche ? ` (${p.niche})` : ''}. A empresa ainda não respondeu.
Vendedor: ${seller}
Mensagem anterior enviada: ${prev}
Ângulo: ${angleForTouch(p.touch, false)}
Regras: no máximo 3 frases curtas, tom natural e humano, sem "Prezados", no máximo 1 emoji, sem links, sem campos como [Nome]. Responda só com o texto da mensagem.`;
}

function cleanMessage(text: string): string {
    return text.trim().replace(/^["“']|["”']$/g, '').replace(/\n{3,}/g, '\n\n').slice(0, MAX_MESSAGE_CHARS).trim();
}

export interface FollowUpMessageResult {
    touch: number;
    message: string;
    cached: boolean;
}

/** Returns the message for the next touch of a saved lead, generating it once if needed. */
export async function getFollowUpMessage(analysisId: string, scope: { userId: string; workspaceId?: string | null }, en: boolean): Promise<FollowUpMessageResult | null> {
    const owner = scope.workspaceId ? { workspaceId: scope.workspaceId } : { userId: scope.userId };
    const analysis = await prisma.leadAnalysis.findFirst({
        where: { id: analysisId, ...owner },
        select: {
            id: true, leadId: true, workspaceId: true, extras: true,
            suggestedWhatsAppMessage: true, firstContactMessage: true,
            lead: { select: { name: true, types: true } },
        },
    });
    if (!analysis) return null;

    const contacts = await prisma.leadEvent.count({ where: { leadId: analysis.leadId, ...owner, type: 'CONTACTED' } });
    const touch = Math.max(2, contacts + 1);
    const extras = (analysis.extras && typeof analysis.extras === 'object' ? analysis.extras : {}) as Extras;
    const cachedMessage = extras.followUpMessages?.[String(touch)];
    if (cachedMessage) return { touch, message: cachedMessage, cached: true };

    const workspace = analysis.workspaceId
        ? await prisma.workspace.findUnique({ where: { id: analysis.workspaceId }, select: { companyName: true, productService: true, mainBenefit: true } })
        : null;
    const previous = extras.followUpMessages?.[String(touch - 1)] ?? analysis.suggestedWhatsAppMessage ?? analysis.firstContactMessage;
    const niche = Array.isArray(analysis.lead.types) ? String(analysis.lead.types[0] ?? '').replace(/_/g, ' ') || null : null;

    const result = await generateCompletionForRole('lead_analysis', {
        prompt: buildFollowUpPrompt({ en, touch, leadName: analysis.lead.name, niche, previousMessage: previous, seller: workspace }),
        maxOutputTokens: 300,
    });
    const message = cleanMessage(result.text);
    if (!message) return null;

    await prisma.leadAnalysis.update({
        where: { id: analysis.id },
        data: { extras: { ...extras, followUpMessages: { ...(extras.followUpMessages ?? {}), [String(touch)]: message } } },
    });
    if (result.usage && analysis.workspaceId) {
        recordUsageEvent({
            workspaceId: analysis.workspaceId,
            userId: scope.userId,
            type: 'AI_TOKENS',
            quantity: 1,
            metadata: { provider: result.provider, model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, kind: 'follow_up' },
        });
    }
    logger.info('Follow-up message generated', { analysisId, touch });
    return { touch, message, cached: false };
}
