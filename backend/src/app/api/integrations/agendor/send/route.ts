import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { getAgendorApiTokenForUser } from '@/lib/agendor-config';

const sendLeadSchema = z.object({
    mode: z.enum(['contact', 'contact_and_deal']).optional(),
    placeId: z.string().min(1),
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().optional(),
    website: z.string().optional(),
    address: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    primaryType: z.string().optional(),
    businessStatus: z.string().optional(),
    score: z.number().optional(),
    scoreLabel: z.string().optional(),
    summary: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    gaps: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    firstContactMessage: z.string().optional(),
    suggestedWhatsAppMessage: z.string().optional(),
    fullReport: z.string().optional(),
    socialMedia: z.object({
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        linkedin: z.string().optional(),
    }).optional(),
    dealName: z.string().optional(),
    dealValue: z.number().optional(),
    funnel: z.number().int().optional(),
    dealStage: z.number().int().optional(),
    ownerUser: z.union([z.number().int(), z.string()]).optional(),
});

function compactString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | undefined): string | null {
    const raw = compactString(value);
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    return digits.length >= 8 ? digits : null;
}

function parseOwnerUser(value: unknown): number | string | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const asNum = Number(value);
        if (Number.isInteger(asNum) && asNum > 0) return asNum;
        return value.trim();
    }
    return null;
}

function getErrorMessage(errBody: unknown, fallback: string): string {
    const bodyObj = errBody as {
        message?: string;
        error?: string;
        errors?: Array<string | { detail?: string; message?: string }>;
    };
    const firstArrayError = Array.isArray(bodyObj?.errors)
        ? bodyObj.errors.find((e) => {
            if (typeof e === 'string') return e.length > 0;
            return typeof e?.detail === 'string' || typeof e?.message === 'string';
        })
        : undefined;

    if (typeof firstArrayError === 'string') return firstArrayError;

    return bodyObj?.message
        ?? bodyObj?.error
        ?? (typeof firstArrayError === 'object' ? (firstArrayError?.detail ?? firstArrayError?.message) : undefined)
        ?? fallback;
}

function parseAddress(raw?: string): { city?: string; state?: string; country?: string } {
    if (!raw) return {};
    const parts = raw.split(',').map((s) => s.trim());
    if (parts.length < 3) return {};
    const secondLast = parts[parts.length - 2] ?? '';
    const last = parts[parts.length - 1] ?? '';
    const cityStateMatch = secondLast.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
    if (cityStateMatch) {
        return { city: cityStateMatch[1].trim(), state: cityStateMatch[2].trim(), country: /brasil|brazil/i.test(last) ? last : 'Brasil' };
    }
    const stateMatch = secondLast.match(/^([A-Z]{2})$/);
    const thirdLast = parts[parts.length - 3] ?? '';
    if (stateMatch && thirdLast) {
        return { city: thirdLast.replace(/^.*-\s*/, '').trim(), state: stateMatch[1], country: /brasil|brazil/i.test(last) ? last : 'Brasil' };
    }
    return {};
}

function socialClean(value: string | undefined): string | null {
    const val = compactString(value);
    if (!val || val.toLowerCase() === 'não encontrado') return null;
    return val;
}

function compactArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => item.length > 0);
}

function buildPersonDescription(lead: z.infer<typeof sendLeadSchema>): string {
    const parts = [
        compactString(lead.summary) ? `Resumo: ${lead.summary}` : null,
        compactString(lead.website) ? `Website: ${lead.website}` : null,
        compactString(lead.address) ? `Endereco: ${lead.address}` : null,
        lead.rating != null ? `Avaliacao Google: ${lead.rating}` : null,
        lead.reviewCount != null ? `Avaliacoes: ${lead.reviewCount}` : null,
        compactString(lead.primaryType) ? `Segmento: ${lead.primaryType}` : null,
        compactString(lead.businessStatus) ? `Status: ${lead.businessStatus}` : null,
        lead.score != null ? `Score IA: ${lead.score}` : null,
        compactString(lead.scoreLabel) ? `Classificacao: ${lead.scoreLabel}` : null,
        `Place ID: ${lead.placeId}`,
    ].filter((v): v is string => !!v);

    return parts.join(' | ').slice(0, 680);
}

function buildDealDescription(lead: z.infer<typeof sendLeadSchema>): string {
    const chunks: string[] = [];
    const append = (title: string, value: string | null) => { if (value) chunks.push(`${title}:\n${value}`); };

    append('Resumo', compactString(lead.summary));

    const meta = [
        `Nome: ${lead.name}`,
        compactString(lead.address) ? `Endereco: ${lead.address}` : null,
        compactString(lead.website) ? `Website: ${lead.website}` : null,
        lead.rating != null ? `Avaliacao Google: ${lead.rating}` : null,
        lead.reviewCount != null ? `Avaliacoes: ${lead.reviewCount}` : null,
        compactString(lead.primaryType) ? `Segmento: ${lead.primaryType}` : null,
        compactString(lead.businessStatus) ? `Status: ${lead.businessStatus}` : null,
        lead.score != null ? `Score IA: ${lead.score}` : null,
        compactString(lead.scoreLabel) ? `Classificacao: ${lead.scoreLabel}` : null,
        `Place ID: ${lead.placeId}`,
    ].filter((v): v is string => !!v).join('\n');
    append('Dados Estruturados', meta);

    const strengths = compactArray(lead.strengths);
    if (strengths.length > 0) append('Pontos Fortes', strengths.map((i) => `- ${i}`).join('\n'));
    const gaps = compactArray(lead.gaps);
    if (gaps.length > 0) append('Gaps/Lacunas', gaps.map((i) => `- ${i}`).join('\n'));
    const painPoints = compactArray(lead.painPoints);
    if (painPoints.length > 0) append('Dores do Lead', painPoints.map((i) => `- ${i}`).join('\n'));

    append('Primeira Mensagem', compactString(lead.firstContactMessage));
    append('Mensagem WhatsApp', compactString(lead.suggestedWhatsAppMessage));
    append('Relatorio Completo', compactString(lead.fullReport));

    const socialLines = [
        socialClean(lead.socialMedia?.instagram) ? `Instagram: ${lead.socialMedia?.instagram}` : null,
        socialClean(lead.socialMedia?.facebook) ? `Facebook: ${lead.socialMedia?.facebook}` : null,
        socialClean(lead.socialMedia?.linkedin) ? `LinkedIn: ${lead.socialMedia?.linkedin}` : null,
    ].filter((v): v is string => !!v);
    if (socialLines.length > 0) append('Redes Sociais', socialLines.join('\n'));

    return chunks.join('\n\n').slice(0, 4000) || `Lead ${lead.name} (${lead.placeId}) enviado pelo Precision IA.`;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { token } = await getAgendorApiTokenForUser(session.user.id);
        if (!token) {
            return NextResponse.json(
                { error: 'Integração Agendor não configurada. Informe seu token na página de Integrações.' },
                { status: 422 }
            );
        }

        const body = await req.json();
        const parsed = sendLeadSchema.safeParse(body);
        if (!parsed.success) {
            const fields = parsed.error.flatten().fieldErrors;
            const msg = Object.values(fields)[0]?.[0] ?? 'Dados inválidos';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        const lead = parsed.data;
        const mode = lead.mode ?? 'contact_and_deal';

        const agendorFetch = async (url: string, payload: Record<string, unknown>, method = 'POST') => {
            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Token ${token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });
            // Retry once on 429 (rate limit)
            if (res.status === 429) {
                await new Promise((r) => setTimeout(r, 1000));
                return fetch(url, {
                    method,
                    headers: {
                        Authorization: `Token ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
            }
            return res;
        };

        const phone = normalizePhone(lead.phone);
        const email = compactString(lead.email) ?? undefined;
        const envOwner = parseOwnerUser(process.env.AGENDOR_OWNER_USER ?? process.env.AGENDOR_USER_OWNER);
        const ownerUser = parseOwnerUser(lead.ownerUser) ?? envOwner;
        const addr = parseAddress(lead.address);

        /* ----- Step 1: Create/update Organization (upsert by name) ----- */
        let organizationId: number | undefined;
        try {
            const orgPayload: Record<string, unknown> = {
                name: lead.name,
                ...(ownerUser ? { ownerUser } : {}),
                ...(compactString(lead.website) ? { website: lead.website } : {}),
                ...(addr.state || addr.city
                    ? {
                        address: {
                            ...(addr.state ? { state: addr.state } : {}),
                            ...(addr.city ? { cityName: addr.city } : {}),
                            ...(addr.country ? { country: addr.country } : {}),
                        },
                    }
                    : {}),
                ...(email ? { contact: { email } } : {}),
                ...(compactString(lead.primaryType) ? { description: `Segmento: ${lead.primaryType}` } : {}),
            };

            const orgRes = await agendorFetch('https://api.agendor.com.br/v3/organizations/upsert', orgPayload);
            if (orgRes.ok) {
                const orgBody = (await orgRes.json().catch(() => ({}))) as { data?: { id?: number } };
                organizationId = orgBody?.data?.id;
            }
        } catch {
            // Organization creation is best-effort; continue with person
        }

        /* ----- Step 2: Build contact object with ALL available fields ----- */
        const contactObj: Record<string, string> = {};
        if (phone) {
            contactObj.mobile = phone;
            contactObj.whatsapp = phone;
            contactObj.work = phone;
        }
        if (email) contactObj.email = email;
        const fb = socialClean(lead.socialMedia?.facebook);
        const ig = socialClean(lead.socialMedia?.instagram);
        const li = socialClean(lead.socialMedia?.linkedin);
        if (fb) contactObj.facebook = fb;
        if (ig) contactObj.instagram = ig;
        if (li) contactObj.linked_in = li;

        /* ----- Step 3: Create/update Person (upsert by email or create) ----- */
        const personPayload: Record<string, unknown> = {
            name: lead.name,
            ...(ownerUser ? { ownerUser } : {}),
            ...(organizationId ? { organization: organizationId } : {}),
            ...(Object.keys(contactObj).length > 0 ? { contact: contactObj } : {}),
            ...(buildPersonDescription(lead) ? { description: buildPersonDescription(lead) } : {}),
        };

        // Use upsert if we have email (most reliable identifier), otherwise plain POST
        const personUrl = email
            ? 'https://api.agendor.com.br/v3/people/upsert'
            : 'https://api.agendor.com.br/v3/people';

        let personRes = await agendorFetch(personUrl, personPayload);

        if (!personRes.ok && personRes.status === 422) {
            // Fallback: minimal payload
            personRes = await agendorFetch(personUrl, {
                name: lead.name,
                ...(ownerUser ? { ownerUser } : {}),
                ...(organizationId ? { organization: organizationId } : {}),
            });
        }

        if (!personRes.ok) {
            const errBody = await personRes.json().catch(() => ({}));
            const agendorError = getErrorMessage(errBody, `Agendor retornou ${personRes.status}`);
            const passthroughStatuses = new Set([400, 401, 403, 404, 409, 422, 429]);
            const status = passthroughStatuses.has(personRes.status) ? personRes.status : 503;
            return NextResponse.json({ error: agendorError }, { status });
        }

        const personBody = (await personRes.json().catch(() => ({}))) as { data?: { id?: number } };
        const personId = personBody?.data?.id;

        if (!personId) {
            return NextResponse.json({ ok: true, personId: null, warning: 'Contato criado no Agendor sem id retornado.' });
        }

        if (mode === 'contact') {
            return NextResponse.json({ ok: true, personId });
        }

        const envFunnel = Number(process.env.AGENDOR_FUNNEL_ID);
        const envDealStage = Number(process.env.AGENDOR_DEAL_STAGE);
        const dealPayload: Record<string, unknown> = {
            title: compactString(lead.dealName) ?? `${lead.name} - Oportunidade Precision`,
            dealStatusText: 'ongoing',
            ...(compactString(buildDealDescription(lead)) ? { description: buildDealDescription(lead) } : {}),
            ...(lead.dealValue != null ? { value: lead.dealValue } : {}),
            ...(ownerUser ? { ownerUser } : {}),
            ...(lead.funnel != null ? { funnel: lead.funnel } : Number.isInteger(envFunnel) && envFunnel > 0 ? { funnel: envFunnel } : {}),
            ...(lead.dealStage != null ? { dealStage: lead.dealStage } : Number.isInteger(envDealStage) && envDealStage > 0 ? { dealStage: envDealStage } : {}),
            checkRequiredFields: false,
        };

        let dealRes = await agendorFetch(`https://api.agendor.com.br/v3/people/${personId}/deals`, dealPayload);

        if (!dealRes.ok && dealRes.status === 422) {
            dealRes = await agendorFetch(`https://api.agendor.com.br/v3/people/${personId}/deals`, {
                title: compactString(lead.dealName) ?? `${lead.name} - Oportunidade Precision`,
                dealStatusText: 'ongoing',
                ...(ownerUser ? { ownerUser } : {}),
                checkRequiredFields: false,
            });
        }

        if (!dealRes.ok) {
            const errBody = await dealRes.json().catch(() => ({}));
            const agendorError = getErrorMessage(errBody, `Agendor (deals) retornou ${dealRes.status}`);
            const { logger } = await import('@/lib/logger');
            logger.warn('Agendor deal creation rejected', {
                status: dealRes.status,
                error: agendorError,
                personId,
                ownerUser,
                rdBody: errBody,
            });

            return NextResponse.json({
                ok: true,
                personId,
                warning: `Contato enviado, mas falhou ao criar negócio no Agendor: ${agendorError}`,
            });
        }

        const dealBody = (await dealRes.json().catch(() => ({}))) as { data?: { id?: number } };
        const dealId = dealBody?.data?.id;

        /* ----- Step 5: Create follow-up task (best-effort) ----- */
        let taskId: number | undefined;
        try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
            const taskPayload: Record<string, unknown> = {
                text: `Fazer contato com ${lead.name} — Lead enviado pelo Precision IA`,
                type: 'WHATSAPP',
                due_date: dueDate.toISOString(),
            };
            const taskRes = await agendorFetch(`https://api.agendor.com.br/v3/people/${personId}/tasks`, taskPayload);
            if (taskRes.ok) {
                const taskBody = (await taskRes.json().catch(() => ({}))) as { data?: { id?: number } };
                taskId = taskBody?.data?.id;
            }
        } catch {
            // Task creation is best-effort
        }

        return NextResponse.json({ ok: true, personId, organizationId, dealId, taskId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Agendor send error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
