/**
 * Replies to outreach e-mails. The cold e-mails say "é só responder este e-mail" — before this,
 * a reply landed in comercial@ unread, nobody was told and the sequence kept sending.
 *
 * scripts/inbound-replies.py (host cron) reads the reply-to mailboxes on our mail server and
 * posts new messages to /api/cron/inbound-replies. For each human reply from a known lead:
 *  - the e-mail sequence stops (status ENGAGED) and the team gets a Telegram alert;
 *  - for the Precision IA mailbox, the lead goes to the company CRM with a task and gets the
 *    promised "pesquisa" right away: 20 companies when the reply names a segment ("dentistas em
 *    Campinas"), otherwise the personal link to build the list in one click.
 * Auto-replies (out of office, "obrigado pelo contato", address changes) are ignored.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { sendEmail } from '@/lib/email';
import { buildEmail } from '@/lib/email-templates';
import { alertInfo } from '@/lib/telegram-alert';
import { fold } from '@/lib/br-cities';
import { parseSearchIntent } from '@/lib/search-intent';
import { SAMPLE_SEGMENTS, buildSample, engageLead, sampleEmailHtml, sampleUrlFor } from '@/lib/sample-list';
import { cityDisplayName } from '@/modules/auto-prospeccao/application/email-sequence.worker';

export const PRECISION_MAILBOX = 'comercial@precisionia.com.br';
const PRECISION_WORKSPACE_ID = 'sys-workspace-precisionia';
const SITE = 'https://precisionia.com.br';
const DEDUP_TTL_SECONDS = 60 * 24 * 60 * 60;

export interface InboundReply {
    mailbox: string;
    messageId: string;
    from: string;
    fromName?: string | null;
    subject: string;
    /** Plain text of the reply, quoted history already stripped by the reader. */
    text: string;
    autoSubmitted?: string | null;
    precedence?: string | null;
    xAutoreply?: string | null;
}

export type InboundAction = 'duplicate' | 'ignored-auto' | 'ignored-unknown' | 'stopped' | 'answered-sample' | 'answered-link' | 'already-answered';

const AUTO_SUBJECT = /resposta autom|automatic reply|auto.?reply|out of office|fora do escrit|aus[eê]ncia|f[ée]rias|obrigad[oa] pelo (seu )?contato|recebemos (a )?sua (mensagem|solicita)|mensagem recebida|meu e-?mail mudou|e-?mail alterado|novo e-?mail|delivery status|undeliver|mail delivery|n[aã]o entregue/i;

export function isAutoReply(r: Pick<InboundReply, 'subject' | 'autoSubmitted' | 'precedence' | 'xAutoreply' | 'from' | 'text'>): boolean {
    if (r.autoSubmitted && !/^no$/i.test(r.autoSubmitted.trim())) return true;
    if (r.precedence && /bulk|junk|list|auto_reply/i.test(r.precedence)) return true;
    if (r.xAutoreply) return true;
    if (/^(mailer-daemon|postmaster|no-?reply|nao-?responda)@/i.test(r.from)) return true;
    // An empty reply to one of our e-mails is still a person raising a hand.
    return AUTO_SUBJECT.test(r.subject);
}

/** Spoken names for the sample segments ("dentista", "salão", "contador"…). */
const SEGMENT_WORDS: Record<string, string[]> = {
    restaurantes: ['restaurante'], academias: ['academia'], 'clinicas-medicas': ['clinica medica', 'clinicas medicas', 'consultorio medico', 'consultorios medicos'],
    dentistas: ['dentista', 'odontolog'], 'saloes-de-beleza': ['salao', 'saloes', 'cabeleireir', 'barbearia'], 'clinicas-de-estetica': ['estetica'],
    'escritorios-de-contabilidade': ['contabil', 'contador'], 'escritorios-de-advocacia': ['advoca', 'advogad'], imobiliarias: ['imobiliaria'],
    construtoras: ['construtora'], transportadoras: ['transportadora'], supermercados: ['supermercado'], padarias: ['padaria'],
    'oficinas-mecanicas': ['oficina', 'mecanica'], farmacias: ['farmacia', 'drogaria'], 'pet-shops': ['pet shop', 'petshop'],
    'lojas-de-roupas': ['loja de roupa', 'lojas de roupa'], 'lojas-de-materiais-de-construcao': ['material de construcao', 'materiais de construcao'],
    'lojas-de-moveis': ['moveis', 'movel'], hoteis: ['hotel', 'hoteis', 'pousada'], 'escolas-de-idiomas': ['idioma', 'escola de ingles'],
    'agencias-de-marketing': ['agencia de marketing', 'agencias de marketing'], 'empresas-de-tecnologia': ['empresa de tecnologia', 'empresas de tecnologia', 'empresa de software'], 'distribuidoras-de-alimentos': ['distribuidora'],
};

/** "Quero dentistas em Campinas" → segment + place; place falls back to the lead's own city. */
export function guessSampleRequest(text: string, fallback: { city: string | null; uf: string | null }): { segment: string; city: string; uf: string } | null {
    const folded = ` ${fold(text).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
    const segment = SAMPLE_SEGMENTS.find((s) => (SEGMENT_WORDS[s.slug] ?? []).some((w) => folded.includes(` ${w}`)));
    if (!segment) return null;
    const intent = parseSearchIntent(text, fallback.uf);
    const city = intent.city ?? fallback.city;
    const uf = intent.city ? intent.state : fallback.uf;
    if (!city || !uf) return null;
    return { segment: segment.slug, city, uf };
}

async function claimOnce(key: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis) return true;
    try {
        return (await redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX')) === 'OK';
    } catch {
        return true;
    }
}

function excerpt(text: string, n = 300): string {
    const t = text.replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n)}…` : t;
}

const replySubject = (subject: string) => (/^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`);

export async function handleInboundReply(r: InboundReply, now = new Date()): Promise<InboundAction> {
    const from = r.from.trim().toLowerCase();
    const mailbox = r.mailbox.trim().toLowerCase();
    if (!(await claimOnce(`inbound:msg:${r.messageId || `${from}:${r.subject}`}`))) return 'duplicate';
    if (isAutoReply(r)) return 'ignored-auto';

    const configs = await prisma.autoProspeccaoConfig.findMany({
        where: { replyToEmail: { equals: mailbox, mode: 'insensitive' } },
        select: { workspaceId: true },
    });
    const workspaceIds = configs.map((c) => c.workspaceId);
    const isPrecision = mailbox === PRECISION_MAILBOX;
    if (isPrecision && !workspaceIds.includes(PRECISION_WORKSPACE_ID)) workspaceIds.push(PRECISION_WORKSPACE_ID);

    const lead = workspaceIds.length
        ? await prisma.prospectedLead.findFirst({
            where: { workspaceId: { in: workspaceIds }, email: { equals: from, mode: 'insensitive' } },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, workspaceId: true, email: true, razaoSocial: true, nomeFantasia: true, telefone: true, ddd: true, status: true, municipio: true, uf: true },
        })
        : null;
    const sampleRequest = isPrecision && !lead
        ? await prisma.sampleRequest.findFirst({ where: { email: from }, orderBy: { createdAt: 'desc' }, select: { city: true, uf: true, segment: true } })
        : null;
    if (!lead && !sampleRequest) return 'ignored-unknown';

    const company = lead ? (lead.nomeFantasia?.trim() || lead.razaoSocial) : (r.fromName?.trim() || from);
    if (lead && !['CONVERTED', 'OPTED_OUT', 'BOUNCED'].includes(lead.status)) {
        await prisma.prospectedLead.update({ where: { id: lead.id }, data: { status: 'ENGAGED', updatedAt: now } });
    }
    await alertInfo('Lead respondeu o e-mail', `${company} <${from}>`, {
        caixa: mailbox,
        assunto: r.subject.slice(0, 120),
        resposta: excerpt(r.text, 400),
    }).catch(() => undefined);

    if (!isPrecision || (lead && lead.workspaceId !== PRECISION_WORKSPACE_ID)) return 'stopped';

    if (lead) {
        await engageLead(lead, {
            note: `Respondeu o e-mail: "${excerpt(r.text, 280)}"`,
            task: 'Responder quem respondeu o e-mail',
            source: 'resposta',
        }, now).catch((err) => logger.warn('Reply lead engagement failed', { error: err instanceof Error ? err.message : 'Unknown' }));
    }

    const fallback = lead
        ? { city: cityDisplayName(lead.municipio, lead.uf) || null, uf: lead.uf ?? null }
        : { city: sampleRequest?.city ?? null, uf: sampleRequest?.uf ?? null };
    const guess = guessSampleRequest(r.text, fallback);
    const headers = r.messageId ? { 'In-Reply-To': r.messageId, References: r.messageId } : undefined;
    const signup = `${SITE}/auth/signup?utm_source=coldmail&utm_medium=reply&utm_campaign=pesquisa`;

    if (guess) {
        const segment = SAMPLE_SEGMENTS.find((s) => s.slug === guess.segment)!;
        const companies = await buildSample(segment.slug, guess.city, guess.uf, now).catch(() => []);
        // At most one list per person by e-mail; after that a human takes over.
        if (companies.length >= 5 && (await claimOnce(`inbound:sample:${from}`))) {
            await prisma.sampleRequest.create({
                data: { email: from, prospectedLeadId: lead?.id ?? null, segment: segment.slug, city: guess.city, uf: guess.uf, resultCount: companies.length, source: 'reply' },
            }).catch(() => undefined);
            await sendEmail(from, replySubject(r.subject), sampleEmailHtml(segment.name, guess.city, guess.uf, companies, signup), {
                replyTo: PRECISION_MAILBOX, headers,
            });
            return 'answered-sample';
        }
    }

    // At most one "how to get your list" answer per person.
    if (!(await claimOnce(`inbound:linked:${from}`))) return 'already-answered';
    const link = lead ? sampleUrlFor(lead.id) : `${SITE}/amostra?utm_source=coldmail&utm_medium=reply`;
    const html = buildEmail({
        title: 'Sua pesquisa de clientes',
        preheader: 'Escolha o tipo de cliente e a cidade — a lista aparece na hora.',
        body: [
            'Obrigado pela resposta! Para montar a sua pesquisa, é só escolher o tipo de cliente que você atende e a cidade: em segundos aparecem 20 empresas reais, com telefone e e-mail, começando pelas que abriram há pouco.',
            'Se preferir, responda este e-mail dizendo o tipo de cliente e a cidade (por exemplo: "clínicas em Santos") que eu te envio a lista por aqui.',
        ],
        ctaHref: link,
        ctaLabel: 'Ver minhas 20 empresas',
        siteUrl: SITE,
    });
    await sendEmail(from, replySubject(r.subject), html, { replyTo: PRECISION_MAILBOX, headers });
    return 'answered-link';
}
