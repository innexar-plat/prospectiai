/**
 * Free sample of 20 companies — the "amostra grátis" promised in cold e-mails and the lead magnet
 * on the public SEO pages. Instant (no one has to read a reply and build a list by hand):
 * the visitor picks a segment and city, sees 20 real companies and gets them by e-mail.
 * A click from a cold e-mail also marks the lead as engaged and opens a deal in the company CRM.
 */
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { findRfCompanies } from '@/lib/rf-query';
import { toRfText } from '@/lib/rf-fuzzy-match';
import { sendEmail } from '@/lib/email';
import { buildEmail } from '@/lib/email-templates';

export const SAMPLE_SIZE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMPANY_WORKSPACE_ID = 'sys-workspace-precisionia';
const COMPANY_USER_ID = 'sys-user-precisionia';
const SITE = 'https://precisionia.com.br';

/** Same segments (slug + CNAE) as the public /empresas pages (scripts/seo-company-stats.py). */
export const SAMPLE_SEGMENTS: Array<{ slug: string; name: string; cnaes: string[] }> = [
    { slug: 'restaurantes', name: 'Restaurantes', cnaes: ['5611'] },
    { slug: 'academias', name: 'Academias', cnaes: ['9313'] },
    { slug: 'clinicas-medicas', name: 'Clínicas médicas', cnaes: ['8630501', '8630502', '8630503'] },
    { slug: 'dentistas', name: 'Clínicas odontológicas', cnaes: ['8630504'] },
    { slug: 'saloes-de-beleza', name: 'Salões de beleza', cnaes: ['9602501'] },
    { slug: 'clinicas-de-estetica', name: 'Clínicas de estética', cnaes: ['9602502'] },
    { slug: 'escritorios-de-contabilidade', name: 'Escritórios de contabilidade', cnaes: ['6920601'] },
    { slug: 'escritorios-de-advocacia', name: 'Escritórios de advocacia', cnaes: ['6911701'] },
    { slug: 'imobiliarias', name: 'Imobiliárias', cnaes: ['6821', '6822'] },
    { slug: 'construtoras', name: 'Construtoras', cnaes: ['4120'] },
    { slug: 'transportadoras', name: 'Transportadoras', cnaes: ['4930'] },
    { slug: 'supermercados', name: 'Supermercados', cnaes: ['4711'] },
    { slug: 'padarias', name: 'Padarias', cnaes: ['1091102', '4721102'] },
    { slug: 'oficinas-mecanicas', name: 'Oficinas mecânicas', cnaes: ['4520'] },
    { slug: 'farmacias', name: 'Farmácias', cnaes: ['4771'] },
    { slug: 'pet-shops', name: 'Pet shops', cnaes: ['4789004'] },
    { slug: 'lojas-de-roupas', name: 'Lojas de roupas', cnaes: ['4781'] },
    { slug: 'lojas-de-materiais-de-construcao', name: 'Lojas de materiais de construção', cnaes: ['4744'] },
    { slug: 'lojas-de-moveis', name: 'Lojas de móveis', cnaes: ['4754'] },
    { slug: 'hoteis', name: 'Hotéis', cnaes: ['5510'] },
    { slug: 'escolas-de-idiomas', name: 'Escolas de idiomas', cnaes: ['8593700'] },
    { slug: 'agencias-de-marketing', name: 'Agências de marketing', cnaes: ['7311', '7319'] },
    { slug: 'empresas-de-tecnologia', name: 'Empresas de tecnologia', cnaes: ['6201', '6202', '6203', '6204', '6209'] },
    { slug: 'distribuidoras-de-alimentos', name: 'Distribuidoras de alimentos', cnaes: ['4639', '4637'] },
];

export class SampleError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

// ── Signed link for cold e-mails ────────────────────────────────────────────

function secret(): string {
    const s = process.env.AUTH_SECRET;
    if (!s) throw new Error('AUTH_SECRET is not set');
    return s;
}

function sign(leadId: string): string {
    return createHmac('sha256', secret()).update(`sample:${leadId}`).digest('hex').slice(0, 20);
}

/** Token for /amostra?t=… in cold e-mails (identifies the prospected lead, cannot be forged). */
export function sampleTokenFor(leadId: string): string {
    return `${leadId}.${sign(leadId)}`;
}

export function sampleUrlFor(leadId: string): string {
    return `${SITE}/amostra?t=${encodeURIComponent(sampleTokenFor(leadId))}`;
}

export function verifySampleToken(token: string | null | undefined): string | null {
    if (!token) return null;
    const [leadId, sig] = token.split('.');
    if (!leadId || !sig) return null;
    const expected = sign(leadId);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b) ? leadId : null;
}

// ── Building the sample ─────────────────────────────────────────────────────

export interface SampleCompany {
    name: string;
    bairro: string | null;
    porte: string | null;
    openedAt: string | null;
    phone: string | null;
    email: string | null;
}

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m) => m.toUpperCase())
    .replace(/\s(De|Da|Do|Das|Dos|E)\s/g, (m) => m.toLowerCase());

function phoneOf(ddd: string | null, telefone: string | null): string | null {
    const digits = `${ddd ?? ''}${telefone ?? ''}`.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const d = digits.slice(-11);
    return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/** 20 contactable companies, recently opened ones first (they are still choosing suppliers). */
/**
 * Company name fit for display. MEI legal names end with the owner's CPF ("JOAO DA SILVA 12345678901")
 * — a personal document that must never be shown, so trailing CPF-like numbers are removed.
 */
export function displayName(nomeFantasia: string | null, razaoSocial: string): string {
    const raw = (nomeFantasia?.trim() || razaoSocial)
        .replace(/^\s*\d{2}\.?\d{3}\.?\d{3}\s+/, '') // MEI names may start with the CNPJ root
        .replace(/\s*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*$/, '')
        .replace(/\s+(LTDA|EIRELI|ME|EPP|S\/?A)\.?$/i, '')
        .trim();
    return titleCase(raw || razaoSocial.replace(/\d{11}/g, '').trim());
}

export async function buildSample(segmentSlug: string, city: string, uf: string, now = new Date()): Promise<SampleCompany[]> {
    const segment = SAMPLE_SEGMENTS.find((s) => s.slug === segmentSlug);
    if (!segment) throw new SampleError('Segmento inválido', 400);
    const base = { cnaes: segment.cnaes, municipio: toRfText(city), uf: uf.toUpperCase(), hasPhone: true };
    // Recently opened first (still choosing suppliers); top up with older ones when there are few.
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * DAY_MS).toISOString().slice(0, 10).replace(/-/g, '');
    let rows = await findRfCompanies({ ...base, openedSince: twoYearsAgo }, SAMPLE_SIZE * 4);
    if (rows.length < SAMPLE_SIZE) {
        const seen = new Set(rows.map((r) => r.cnpj));
        rows = [...rows, ...(await findRfCompanies(base, SAMPLE_SIZE * 4)).filter((r) => !seen.has(r.cnpj))];
    }
    return rows
        .sort((a, b) => (b.dataAbertura ?? '').localeCompare(a.dataAbertura ?? '') || Number(Boolean(b.email)) - Number(Boolean(a.email)))
        .slice(0, SAMPLE_SIZE)
        .map((c) => ({
            name: displayName(c.nomeFantasia, c.razaoSocial),
            bairro: c.bairro ? titleCase(c.bairro) : null,
            porte: c.porte === 'ME' ? 'Micro' : c.porte === 'EPP' ? 'Pequena' : c.porte ? 'Média/Grande' : null,
            openedAt: c.dataAbertura && /^\d{8}$/.test(c.dataAbertura) ? `${c.dataAbertura.slice(6, 8)}/${c.dataAbertura.slice(4, 6)}/${c.dataAbertura.slice(0, 4)}` : null,
            phone: phoneOf(c.ddd, c.telefone),
            email: c.email?.trim().toLowerCase() || null,
        }));
}

// ── Request flow ────────────────────────────────────────────────────────────

const MAX_PER_IP_DAY = 5;
const MAX_PER_EMAIL_DAY = 3;

export interface SampleInput {
    token?: string | null;
    email?: string | null;
    segment: string;
    city: string;
    uf: string;
    ip?: string | null;
}

function sampleEmailHtml(segmentName: string, city: string, uf: string, companies: SampleCompany[], ctaHref: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = companies.map((c) => `<tr><td style="padding:8px 10px;border-bottom:1px solid #eef0f4;">`
        + `<div style="font-weight:600;color:#111827;">${esc(c.name)}</div>`
        + `<div style="font-size:12px;color:#6b7280;">${esc([c.bairro, c.porte, c.openedAt ? `aberta em ${c.openedAt}` : null].filter(Boolean).join(' · '))}</div>`
        + `<div style="font-size:13px;color:#374151;">${esc([c.phone, c.email].filter(Boolean).join(' · '))}</div></td></tr>`).join('');
    return buildEmail({
        title: `Sua amostra: ${segmentName} em ${city} (${uf})`,
        preheader: `${companies.length} empresas com contato para você começar hoje.`,
        body: [
            `Aqui estão ${companies.length} empresas de ${segmentName.toLowerCase()} em ${city}, com as mais recentes primeiro — quem abriu há pouco ainda está escolhendo fornecedores.`,
            `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate;">${rows}</table>`,
            'Na Precision IA você vê a lista completa da sua região, a nota de chance de compra de cada empresa e a mensagem de abordagem pronta — e acompanha tudo no funil de vendas.',
        ],
        ctaHref,
        ctaLabel: 'Ver a lista completa — 7 dias grátis',
        siteUrl: SITE,
    });
}

/** Creates (or reuses) the sample, e-mails it and, for cold-email clicks, engages the lead. */
export async function requestSample(input: SampleInput, now = new Date()) {
    const segment = SAMPLE_SEGMENTS.find((s) => s.slug === input.segment);
    if (!segment) throw new SampleError('Escolha um segmento', 400);
    const city = input.city.trim();
    const uf = input.uf.trim().toUpperCase();
    if (city.length < 2 || !/^[A-Z]{2}$/.test(uf)) throw new SampleError('Informe a cidade e o estado', 400);

    const leadId = verifySampleToken(input.token);
    const lead = leadId
        ? await prisma.prospectedLead.findUnique({ where: { id: leadId }, select: { id: true, email: true, razaoSocial: true, nomeFantasia: true, telefone: true, ddd: true, status: true } })
        : null;
    const email = (lead?.email ?? input.email ?? '').trim().toLowerCase();
    if (!lead && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SampleError('Informe um e-mail válido para receber a lista', 400);

    const ipHash = input.ip ? createHash('sha256').update(`${input.ip}:${secret()}`).digest('hex').slice(0, 32) : null;
    const since = new Date(now.getTime() - DAY_MS);
    const [byIp, byEmail] = await Promise.all([
        ipHash ? prisma.sampleRequest.count({ where: { ipHash, createdAt: { gte: since } } }) : 0,
        email ? prisma.sampleRequest.count({ where: { email, createdAt: { gte: since } } }) : 0,
    ]);
    if (byIp >= MAX_PER_IP_DAY || byEmail >= MAX_PER_EMAIL_DAY) {
        throw new SampleError('Você já pediu várias amostras hoje. Para ver mais empresas, teste grátis por 7 dias.', 429);
    }

    const companies = await buildSample(segment.slug, city, uf);
    await prisma.sampleRequest.create({
        data: { email: email || null, prospectedLeadId: lead?.id ?? null, segment: segment.slug, city, uf, resultCount: companies.length, source: lead ? 'coldmail' : 'seo', ipHash },
    });

    const signup = `${SITE}/auth/signup?utm_source=${lead ? 'coldmail' : 'seo'}&utm_campaign=amostra`;
    if (email && companies.length > 0) {
        await sendEmail(email, `Sua amostra: ${segment.name} em ${city}`, sampleEmailHtml(segment.name, city, uf, companies, signup), { replyTo: 'comercial@precisionia.com.br' })
            .catch((err) => logger.warn('Sample e-mail failed', { error: err instanceof Error ? err.message : 'Unknown' }));
    }
    if (lead) await engageLead(lead, segment.name, city, uf, now).catch((err) => logger.warn('Sample lead engagement failed', { error: err instanceof Error ? err.message : 'Unknown' }));

    return { segment: segment.name, city, uf, companies, fromColdEmail: Boolean(lead) };
}

/** A cold-email lead that asked for a sample is warm: mark it and put it in the company CRM. */
async function engageLead(
    lead: { id: string; email: string | null; razaoSocial: string; nomeFantasia: string | null; telefone: string | null; ddd: string | null; status: string },
    segmentName: string, city: string, uf: string, now: Date,
) {
    if (lead.status !== 'CONVERTED') {
        await prisma.prospectedLead.update({ where: { id: lead.id }, data: { status: 'ENGAGED', updatedAt: now } });
    }
    const pipeline = await prisma.crmPipeline.findFirst({ where: { workspaceId: COMPANY_WORKSPACE_ID }, select: { id: true, stages: { where: { kind: 'OPEN' }, orderBy: { position: 'asc' }, select: { id: true } } } });
    const stageId = pipeline?.stages[1]?.id ?? pipeline?.stages[0]?.id;
    if (!pipeline || !stageId) return;
    const company = lead.nomeFantasia?.trim() || lead.razaoSocial;
    const existing = await prisma.crmDeal.findFirst({ where: { workspaceId: COMPANY_WORKSPACE_ID, companyName: company, stage: { kind: 'OPEN' } }, select: { id: true } });
    const note = `Pediu amostra grátis: ${segmentName} em ${city} (${uf}). Ligar enquanto o interesse está quente.`;
    if (existing) {
        await prisma.crmActivity.create({ data: { workspaceId: COMPANY_WORKSPACE_ID, dealId: existing.id, userId: COMPANY_USER_ID, type: 'NOTE', body: note, doneAt: now } });
        return;
    }
    await prisma.crmDeal.create({
        data: {
            workspaceId: COMPANY_WORKSPACE_ID, pipelineId: pipeline.id, stageId, title: company, companyName: company,
            contactEmail: lead.email, contactPhone: phoneOf(lead.ddd, lead.telefone), source: 'amostra', ownerUserId: COMPANY_USER_ID,
            createdById: COMPANY_USER_ID, lastActivityAt: now,
            activities: {
                create: [
                    { workspaceId: COMPANY_WORKSPACE_ID, userId: COMPANY_USER_ID, type: 'NOTE', body: note, doneAt: now },
                    { workspaceId: COMPANY_WORKSPACE_ID, userId: COMPANY_USER_ID, type: 'TASK', title: 'Ligar para quem pediu a amostra', dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
                ],
            },
        },
    });
}
