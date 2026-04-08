/**
 * POST /api/integrations/rdstation/send
 * Sends a lead to RD Station (CRM contact or Marketing conversion, depending on mode).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
    forceRefreshRdTokenIfPossible,
    getRdProductMode,
    getRdSendLeadUrl,
    getValidRdStationAccessToken,
} from '@/lib/rdstation-oauth';

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
    businessStatus: z.string().optional(),
    primaryType: z.string().optional(),
    score: z.number().optional(),
    scoreLabel: z.string().optional(),
    summary: z.string().optional(),
    strengths: z.array(z.string()).optional(),
    weaknesses: z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    painPoints: z.array(z.string()).optional(),
    gaps: z.array(z.string()).optional(),
    reviewAnalysis: z.string().optional(),
    reviewTrend: z.string().optional(),
    suggestedContactTime: z.string().optional(),
    contactStrategy: z.string().optional(),
    firstContactMessage: z.string().optional(),
    suggestedWhatsAppMessage: z.string().optional(),
    fullReport: z.string().optional(),
    socialMedia: z
        .object({
            instagram: z.string().optional(),
            facebook: z.string().optional(),
            linkedin: z.string().optional(),
        })
        .optional(),
    stageId: z.string().optional(),
    pipelineId: z.string().optional(),
    ownerId: z.string().optional(),
    sourceId: z.string().optional(),
    campaignId: z.string().optional(),
    dealName: z.string().optional(),
    expectedCloseDate: z.string().optional(),
});

function compactString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function compactArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
}

function sanitizePhone(phone: string | undefined): string | null {
    const raw = compactString(phone);
    if (!raw) return null;
    const normalized = raw.replace(/[^\d+]/g, '');
    return normalized.length >= 8 ? normalized : raw;
}

function socialUsername(raw: string | undefined): string | null {
    const val = compactString(raw);
    if (!val) return null;
    try {
        const url = new URL(val);
        const path = url.pathname.replace(/^\/+|\/+$/g, '');
        if (!path) return null;
        return path.length > 100 ? path.slice(0, 100) : path;
    } catch {
        return val.length > 100 ? val.slice(0, 100) : val;
    }
}

function toDatePlusDays(days: number): string {
    const dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString().slice(0, 10);
}

function buildDealNote(lead: z.infer<typeof sendLeadSchema>): string {
    const sections: string[] = [];
    const append = (title: string, value: string | null) => {
        if (!value) return;
        sections.push(`${title}\n${value}`);
    };

    append('Resumo do Lead', compactString(lead.summary));

    const leadMeta = [
        `Nome: ${lead.name}`,
        compactString(lead.address) ? `Endereco: ${lead.address}` : null,
        compactString(lead.phone) ? `Telefone: ${lead.phone}` : null,
        compactString(lead.website) ? `Website: ${lead.website}` : null,
        lead.score != null ? `Score: ${String(lead.score)}` : null,
        compactString(lead.scoreLabel) ? `Classificacao: ${lead.scoreLabel}` : null,
        lead.rating != null ? `Avaliacao Google: ${String(lead.rating)}` : null,
        lead.reviewCount != null ? `Quantidade de avaliacoes: ${String(lead.reviewCount)}` : null,
        compactString(lead.primaryType) ? `Tipo principal: ${lead.primaryType}` : null,
        compactString(lead.businessStatus) ? `Status do negocio: ${lead.businessStatus}` : null,
        `Place ID: ${lead.placeId}`,
    ]
        .filter((line): line is string => !!line)
        .join('\n');
    append('Dados Estruturados', leadMeta);

    append('Analise de Avaliacoes', compactString(lead.reviewAnalysis));
    append('Tendencia', compactString(lead.reviewTrend));
    append('Melhor Horario de Contato', compactString(lead.suggestedContactTime));
    append('Estrategia de Contato', compactString(lead.contactStrategy));
    append('Primeira Mensagem', compactString(lead.firstContactMessage));
    append('Mensagem WhatsApp', compactString(lead.suggestedWhatsAppMessage));
    append('Relatorio Completo', compactString(lead.fullReport));

    const strengths = compactArray(lead.strengths);
    if (strengths.length > 0) append('Pontos Fortes', strengths.map((i) => `- ${i}`).join('\n'));

    const weaknesses = compactArray(lead.weaknesses);
    if (weaknesses.length > 0) append('Fraquezas', weaknesses.map((i) => `- ${i}`).join('\n'));

    const opportunities = compactArray(lead.opportunities);
    if (opportunities.length > 0) append('Oportunidades', opportunities.map((i) => `- ${i}`).join('\n'));

    const painPoints = compactArray(lead.painPoints);
    if (painPoints.length > 0) append('Pain Points', painPoints.map((i) => `- ${i}`).join('\n'));

    const gaps = compactArray(lead.gaps);
    if (gaps.length > 0) append('Gaps', gaps.map((i) => `- ${i}`).join('\n'));

    const socialLines = [
        compactString(lead.socialMedia?.instagram) ? `Instagram: ${lead.socialMedia?.instagram}` : null,
        compactString(lead.socialMedia?.facebook) ? `Facebook: ${lead.socialMedia?.facebook}` : null,
        compactString(lead.socialMedia?.linkedin) ? `LinkedIn: ${lead.socialMedia?.linkedin}` : null,
    ].filter((line): line is string => !!line);
    if (socialLines.length > 0) append('Redes Sociais', socialLines.join('\n'));

    const text = sections.join('\n\n').slice(0, 12000);
    return text || `Lead ${lead.name} (${lead.placeId}) enviado pelo Precision IA.`;
}

function getErrorMessage(errBody: unknown, fallback: string): string {
    const bodyObj = errBody as {
        error?: string;
        error_description?: string;
        message?: string;
        errors?: Array<{ message?: string; field?: string }>;
    };
    const firstArrayError = Array.isArray(bodyObj?.errors)
        ? bodyObj.errors.find((e) => typeof e?.message === 'string')
        : undefined;

    return bodyObj?.error_description
        ?? bodyObj?.message
        ?? bodyObj?.error
        ?? firstArrayError?.message
        ?? fallback;
}

async function fetchRdDefaultStageId(accessToken: string, preferredPipelineId?: string | null): Promise<{ stageId: string | null; pipelineId: string | null }> {
    const api = 'https://api.rd.services/crm/v2';

    const getJson = async (url: string): Promise<unknown> => {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) return null;
        return res.json().catch(() => null);
    };

    const pickId = (obj: unknown): string | null => {
        if (!obj || typeof obj !== 'object') return null;
        const maybe = obj as { id?: unknown };
        return typeof maybe.id === 'string' && maybe.id.trim() ? maybe.id.trim() : null;
    };

    const pickItems = (obj: unknown): unknown[] => {
        if (!obj || typeof obj !== 'object') return [];
        const maybe = obj as { data?: unknown; items?: unknown };
        if (Array.isArray(maybe.data)) return maybe.data;
        if (Array.isArray(maybe.items)) return maybe.items;
        return [];
    };

    const resolveStageFromPipeline = async (pipelineId: string): Promise<string | null> => {
        const stagesBody = await getJson(`${api}/pipelines/${encodeURIComponent(pipelineId)}/stages`);
        const stages = pickItems(stagesBody);
        for (const stage of stages) {
            const stageId = pickId(stage);
            if (stageId) return stageId;
        }
        return null;
    };

    const preferred = compactString(preferredPipelineId);
    if (preferred) {
        const stageId = await resolveStageFromPipeline(preferred);
        if (stageId) return { stageId, pipelineId: preferred };
    }

    const pipelinesBody = await getJson(`${api}/pipelines`);
    const pipelines = pickItems(pipelinesBody);
    for (const pipeline of pipelines) {
        const pipelineId = pickId(pipeline);
        if (!pipelineId) continue;
        const stageId = await resolveStageFromPipeline(pipelineId);
        if (stageId) return { stageId, pipelineId };
    }

    return { stageId: null, pipelineId: preferred ?? null };
}

async function fetchRdDefaultOwnerId(accessToken: string): Promise<string | null> {
    const api = 'https://api.rd.services/crm/v2/users?page[number]=1&page[size]=50';
    const res = await fetch(api, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) return null;

    const body = (await res.json().catch(() => null)) as { data?: Array<{ id?: string }> } | null;
    const first = body?.data?.find((item) => typeof item?.id === 'string' && item.id.trim().length > 0);
    return first?.id?.trim() ?? null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        const hasRefresh = !!(user as unknown as { rdStationRefreshToken?: string | null }).rdStationRefreshToken;
        const initialToken = await getValidRdStationAccessToken(session.user.id);

        if (!initialToken) {
            return NextResponse.json(
                { error: 'Integração RD Station não configurada. Acesse Conta > Integrações.' },
                { status: 422 }
            );
        }
        let token = initialToken;

        const body = await req.json();
        const result = sendLeadSchema.safeParse(body);
        if (!result.success) {
            const fields = result.error.flatten().fieldErrors;
            const msg = Object.values(fields)[0]?.[0] ?? 'Dados inválidos';
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        const lead = result.data;
        const mode = lead.mode ?? 'contact';

        const productMode = getRdProductMode();
        const rdUrl = getRdSendLeadUrl();

        /* ----- Address parsing: extract city / state / country ----- */
        const addressParts = (lead.address ?? '').split(',').map((s: string) => s.trim());
        let parsedCity: string | null = null;
        let parsedState: string | null = null;
        let parsedCountry: string | null = null;

        if (addressParts.length >= 3) {
            const secondLast = addressParts[addressParts.length - 2] ?? '';
            const last = addressParts[addressParts.length - 1] ?? '';
            const cityStateMatch = secondLast.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
            if (cityStateMatch) {
                parsedCity = cityStateMatch[1].trim();
                parsedState = cityStateMatch[2].trim();
                parsedCountry = /brasil|brazil/i.test(last) ? last : 'Brasil';
            } else {
                const stateMatch = secondLast.match(/^([A-Z]{2})$/);
                const thirdLast = addressParts[addressParts.length - 3] ?? '';
                if (stateMatch && thirdLast) {
                    parsedCity = thirdLast.replace(/^.*-\s*/, '').trim();
                    parsedState = stateMatch[1];
                    parsedCountry = /brasil|brazil/i.test(last) ? last : 'Brasil';
                }
            }
        }

        /* ----- Build social_profiles array for CRM ----- */
        const socialProfiles: Array<{ type: string; username: string }> = [];
        const fbUser = socialUsername(lead.socialMedia?.facebook);
        const liUser = socialUsername(lead.socialMedia?.linkedin);
        if (fbUser) socialProfiles.push({ type: 'facebook', username: fbUser });
        if (liUser) socialProfiles.push({ type: 'linkedin', username: liUser });

        const payload = productMode === 'marketing'
            ? {
                event_type: 'CONVERSION',
                event_family: 'CDP',
                payload: {
                    conversion_identifier: 'Precision IA — Lead Mapeado',
                    name: lead.name,
                    ...(lead.phone ? { personal_phone: lead.phone } : {}),
                    ...(lead.website ? { website: lead.website } : {}),
                    ...(parsedCity ? { city: parsedCity } : {}),
                    ...(parsedState ? { state: parsedState } : {}),
                    ...(parsedCountry ? { country: parsedCountry } : {}),
                    ...(lead.summary ? { bio: lead.summary.slice(0, 1000) } : {}),
                    ...(socialUsername(lead.socialMedia?.facebook) ? { facebook: lead.socialMedia?.facebook } : {}),
                    ...(socialUsername(lead.socialMedia?.linkedin) ? { linkedin: lead.socialMedia?.linkedin } : {}),
                    ...(socialUsername(lead.socialMedia?.instagram) ? { twitter: lead.socialMedia?.instagram } : {}),
                    tags: ['prospector-ai', ...(lead.scoreLabel ? [lead.scoreLabel.toLowerCase()] : []), ...(lead.primaryType ? [lead.primaryType] : [])],
                    cf_prospector_place_id: lead.placeId,
                    ...(lead.score != null ? { cf_prospector_score: String(lead.score) } : {}),
                    ...(lead.scoreLabel ? { cf_prospector_score_label: lead.scoreLabel } : {}),
                    ...(lead.summary ? { cf_prospector_summary: lead.summary.slice(0, 500) } : {}),
                    ...(lead.address ? { cf_prospector_address: lead.address } : {}),
                    ...(lead.reviewTrend ? { cf_prospector_review_trend: lead.reviewTrend.slice(0, 200) } : {}),
                    ...(lead.suggestedContactTime ? { cf_prospector_contact_time: lead.suggestedContactTime.slice(0, 200) } : {}),
                    ...(lead.primaryType ? { cf_prospector_segment: lead.primaryType } : {}),
                    ...(lead.rating != null ? { cf_prospector_google_rating: String(lead.rating) } : {}),
                    ...(lead.reviewCount != null ? { cf_prospector_review_count: String(lead.reviewCount) } : {}),
                    ...(lead.businessStatus ? { cf_prospector_business_status: lead.businessStatus } : {}),
                },
            }
            : {
                name: lead.name,
                ...(compactString(lead.email) ? { emails: [{ email: lead.email!.trim() }] } : {}),
                ...(sanitizePhone(lead.phone) ? { phones: [{ phone: sanitizePhone(lead.phone), type: 'work' }] } : {}),
                ...(socialProfiles.length > 0 ? { social_profiles: socialProfiles } : {}),
            };

        const postToRd = async (
            url: string,
            bodyPayload: Record<string, unknown>,
            options?: { retryWithDataWrapper?: boolean }
        ): Promise<Response> => {
            const doRequest = async (accessToken: string, wrapped: boolean) =>
                fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(wrapped ? { data: bodyPayload } : bodyPayload),
                });

            let response = await doRequest(token, false);

            if (!response.ok && response.status === 401 && hasRefresh) {
                const refreshed = await forceRefreshRdTokenIfPossible(session.user.id);
                if (refreshed) {
                    token = refreshed;
                    response = await doRequest(token, false);
                }
            }

            if (!response.ok && response.status === 422 && options?.retryWithDataWrapper) {
                response = await doRequest(token, true);
            }

            return response;
        };

        let rdRes = await postToRd(rdUrl, payload as Record<string, unknown>, {
            retryWithDataWrapper: productMode === 'crm',
        });

        // Some RD accounts validate optional contact fields differently; fallback to minimal payload.
        if (!rdRes.ok && rdRes.status === 422 && productMode === 'crm' && rdUrl.includes('/crm/v2/contacts')) {
            rdRes = await postToRd(rdUrl, { name: lead.name }, {
                retryWithDataWrapper: true,
            });
        }

        if (!rdRes.ok) {
            const errBody = await rdRes.json().catch(() => ({}));
            const rdError = getErrorMessage(errBody, `RD Station (${productMode}) retornou ${rdRes.status}`);

            const passthroughStatuses = new Set([400, 401, 403, 404, 409, 422, 429]);
            const responseStatus = passthroughStatuses.has(rdRes.status)
                ? rdRes.status
                : rdRes.status >= 500
                    ? 503
                    : 422;

            const { logger } = await import('@/lib/logger');
            logger.warn('RD Station send rejected', {
                status: rdRes.status,
                mappedStatus: responseStatus,
                product: productMode,
                error: rdError,
                rdBody: errBody,
            });

            return NextResponse.json(
                { error: rdError },
                { status: responseStatus }
            );
        }

        const createdBody = await rdRes.json().catch(() => ({})) as { data?: { id?: string } };
        const contactId = createdBody?.data?.id;

        if (productMode !== 'crm' || mode === 'contact') {
            return NextResponse.json({ ok: true, product: productMode, contactId });
        }

        let stageId = compactString(lead.stageId) ?? compactString(process.env.RD_STATION_CRM_STAGE_ID);
        let pipelineId = compactString(lead.pipelineId) ?? compactString(process.env.RD_STATION_CRM_PIPELINE_ID);

        if (!stageId) {
            const discovered = await fetchRdDefaultStageId(token, pipelineId);
            stageId = discovered.stageId;
            pipelineId = pipelineId ?? discovered.pipelineId;
        }

        if (!stageId) {
            return NextResponse.json({
                ok: true,
                product: productMode,
                contactId,
                warning:
                    'Contato enviado, mas negociacao nao foi criada: nao foi possivel localizar um stage_id no RD CRM. Configure RD_STATION_CRM_STAGE_ID (ou envie stageId).',
            });
        }

        const scoreRating = lead.score != null
            ? Math.max(1, Math.min(5, Math.round(lead.score / 20)))
            : undefined;

        let ownerId = compactString(lead.ownerId)
            ?? compactString(process.env.RD_STATION_CRM_OWNER_ID)
            ?? compactString(process.env.RD_STATION_CRM_USER_ID);

        if (!ownerId) {
            ownerId = await fetchRdDefaultOwnerId(token);
        }

        /* ----- Create Organization (best-effort) ----- */
        let organizationId: string | null = null;
        try {
            const orgPayload: Record<string, unknown> = {
                name: lead.name,
            };
            const orgRes = await postToRd('https://api.rd.services/crm/v2/organizations', orgPayload, {
                retryWithDataWrapper: true,
            });
            if (orgRes.ok) {
                const orgBody = await orgRes.json().catch(() => ({})) as { data?: { id?: string } };
                organizationId = orgBody?.data?.id ?? null;
            }
        } catch {
            // Organization creation is best-effort
        }

        const sourceId = compactString(lead.sourceId) ?? compactString(process.env.RD_STATION_CRM_SOURCE_ID);
        const campaignId = compactString(lead.campaignId) ?? compactString(process.env.RD_STATION_CRM_CAMPAIGN_ID);

        const dealPayload: Record<string, unknown> = {
            name: compactString(lead.dealName) ?? `${lead.name} - Oportunidade Precision`,
            status: 'ongoing',
            stage_id: stageId,
            ...(pipelineId ? { pipeline_id: pipelineId } : {}),
            ...(ownerId ? { owner_id: ownerId } : {}),
            ...(contactId ? { contact_ids: [contactId] } : {}),
            ...(organizationId ? { organization_id: organizationId } : {}),
            ...(sourceId ? { source_id: sourceId } : {}),
            ...(campaignId ? { campaign_id: campaignId } : {}),
            ...(compactString(lead.expectedCloseDate)
                ? { expected_close_date: lead.expectedCloseDate }
                : { expected_close_date: toDatePlusDays(14) }),
            ...(scoreRating ? { rating: scoreRating } : {}),
        };

        let dealRes = await postToRd('https://api.rd.services/crm/v2/deals', dealPayload, {
            retryWithDataWrapper: true,
        });

        if (!dealRes.ok && dealRes.status === 422) {
            const minimalDealPayload: Record<string, unknown> = {
                name: compactString(lead.dealName) ?? `${lead.name} - Oportunidade Precision`,
                status: 'ongoing',
                stage_id: stageId,
                ...(ownerId ? { owner_id: ownerId } : {}),
                ...(contactId ? { contact_ids: [contactId] } : {}),
            };

            dealRes = await postToRd('https://api.rd.services/crm/v2/deals', minimalDealPayload, {
                retryWithDataWrapper: true,
            });
        }

        if (!dealRes.ok) {
            const errBody = await dealRes.json().catch(() => ({}));
            const rdError = getErrorMessage(errBody, `RD Station (crm/deals) retornou ${dealRes.status}`);
            const { logger } = await import('@/lib/logger');
            logger.warn('RD Station deal creation rejected', {
                status: dealRes.status,
                error: rdError,
                rdBody: errBody,
                stageId,
                pipelineId,
                ownerId,
                hasContactId: !!contactId,
            });

            return NextResponse.json({
                ok: true,
                product: productMode,
                contactId,
                warning: `Contato enviado, mas falhou ao criar negociacao: ${rdError}`,
            });
        }

        const dealBody = await dealRes.json().catch(() => ({})) as { data?: { id?: string } };
        const dealId = dealBody?.data?.id;

        if (!dealId) {
            return NextResponse.json({ ok: true, product: productMode, contactId, warning: 'Negociacao criada sem id retornado.' });
        }

        const notePayload: Record<string, unknown> = {
            description: buildDealNote(lead),
        };
        const noteRes = await postToRd(`https://api.rd.services/crm/v2/deals/${encodeURIComponent(dealId)}/notes`, notePayload, {
            retryWithDataWrapper: true,
        });

        if (!noteRes.ok) {
            const errBody = await noteRes.json().catch(() => ({}));
            const rdError = getErrorMessage(errBody, `RD Station (crm/notes) retornou ${noteRes.status}`);
            return NextResponse.json({
                ok: true,
                product: productMode,
                contactId,
                dealId,
                warning: `Negociacao criada, mas a anotacao completa falhou: ${rdError}`,
            });
        }

        const noteBody = await noteRes.json().catch(() => ({})) as { data?: { id?: string } };

        /* ----- Create follow-up task (best-effort) ----- */
        let taskId: string | undefined;
        try {
            const taskPayload: Record<string, unknown> = {
                name: `Fazer contato com ${lead.name} — Lead Precision IA`,
                due_date: toDatePlusDays(1),
                ...(dealId ? { deal_id: dealId } : {}),
                ...(ownerId ? { user_id: ownerId } : {}),
            };
            const taskRes = await postToRd('https://api.rd.services/crm/v2/tasks', taskPayload, {
                retryWithDataWrapper: true,
            });
            if (taskRes.ok) {
                const taskBody = await taskRes.json().catch(() => ({})) as { data?: { id?: string } };
                taskId = taskBody?.data?.id;
            }
        } catch {
            // Task creation is best-effort
        }

        return NextResponse.json({ ok: true, product: productMode, contactId, dealId, organizationId, noteId: noteBody?.data?.id, taskId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('RD Station send error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
