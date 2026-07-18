/**
 * POST /api/integrations/hubspot/send
 * Sends a lead to HubSpot CRM (contact only, or contact + deal).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import {
    forceRefreshHubspotTokenIfPossible,
    getValidHubspotAccessToken,
} from '@/lib/hubspot-oauth';

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
    pipelineId: z.string().optional(),
    stageId: z.string().optional(),
    ownerId: z.string().optional(),
    dealName: z.string().optional(),
    dealValue: z.number().optional(),
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

function buildContactNote(lead: z.infer<typeof sendLeadSchema>): string {
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

    const text = sections.join('\n\n').slice(0, 65000);
    return text || `Lead ${lead.name} (${lead.placeId}) enviado pelo Precision IA.`;
}

function getErrorMessage(errBody: unknown, fallback: string): string {
    const bodyObj = errBody as {
        message?: string;
        status?: string;
        errors?: Array<{ message?: string }>;
    };
    const firstArrayError = Array.isArray(bodyObj?.errors)
        ? bodyObj.errors.find((e) => typeof e?.message === 'string')
        : undefined;

    return bodyObj?.message
        ?? firstArrayError?.message
        ?? bodyObj?.status
        ?? fallback;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const initialToken = await getValidHubspotAccessToken(session.user.id);
        if (!initialToken) {
            return NextResponse.json(
                { error: 'Integração HubSpot não configurada. Acesse Conta > Integrações.' },
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

        /* Helper to make HubSpot API calls with auto-refresh */
        const hubspotFetch = async (url: string, options: RequestInit): Promise<Response> => {
            let res = await fetch(url, {
                ...options,
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...(options.headers ?? {}),
                },
            });

            if (!res.ok && res.status === 401) {
                const refreshed = await forceRefreshHubspotTokenIfPossible(session.user.id);
                if (refreshed) {
                    token = refreshed;
                    res = await fetch(url, {
                        ...options,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            ...(options.headers ?? {}),
                        },
                    });
                }
            }

            return res;
        };

        /* ----- Parse name parts ----- */
        const nameParts = lead.name.trim().split(/\s+/);
        const firstName = nameParts[0] ?? lead.name;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        /* ----- Address parsing ----- */
        const addressParts = (lead.address ?? '').split(',').map((s: string) => s.trim());
        let parsedCity: string | null = null;
        let parsedState: string | null = null;
        let parsedCountry: string | null = null;

        if (addressParts.length >= 3) {
            const secondLast = addressParts[addressParts.length - 2] ?? '';
            const last = addressParts[addressParts.length - 1] ?? '';
            const cityStateMatch = secondLast.match(/^(.+?)\s*-\s*([A-Z]{2})$/);
            if (cityStateMatch) {
                parsedCity = cityStateMatch[1]!.trim();
                parsedState = cityStateMatch[2]!.trim();
                parsedCountry = /brasil|brazil/i.test(last) ? 'Brazil' : last;
            }
        }

        /* ----- Create Contact ----- */
        const contactProperties: Record<string, string> = {
            firstname: firstName,
            company: lead.name,
        };
        if (lastName) contactProperties.lastname = lastName;
        if (compactString(lead.email)) contactProperties.email = lead.email!.trim();
        if (sanitizePhone(lead.phone)) contactProperties.phone = sanitizePhone(lead.phone)!;
        if (compactString(lead.website)) contactProperties.website = lead.website!.trim();
        if (compactString(lead.address)) contactProperties.address = lead.address!;
        if (parsedCity) contactProperties.city = parsedCity;
        if (parsedState) contactProperties.state = parsedState;
        if (parsedCountry) contactProperties.country = parsedCountry;

        let contactRes = await hubspotFetch('https://api.hubapi.com/crm/v3/objects/contacts', {
            method: 'POST',
            body: JSON.stringify({ properties: contactProperties }),
        });

        // If 409 (duplicate), try to extract existing contact ID
        let contactId: string | null = null;
        if (contactRes.status === 409) {
            const errBody = (await contactRes.json().catch(() => ({}))) as { message?: string };
            const idMatch = errBody.message?.match(/Existing ID:\s*(\d+)/i);
            if (idMatch) {
                contactId = idMatch[1]!;
                // Update existing contact
                await hubspotFetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ properties: contactProperties }),
                });
            }
        } else if (!contactRes.ok) {
            // Retry with minimal payload
            contactRes = await hubspotFetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                method: 'POST',
                body: JSON.stringify({
                    properties: {
                        firstname: firstName,
                        ...(lastName ? { lastname: lastName } : {}),
                        company: lead.name,
                    },
                }),
            });

            if (!contactRes.ok) {
                const errBody = await contactRes.json().catch(() => ({}));
                const hsError = getErrorMessage(errBody, `HubSpot retornou ${contactRes.status}`);
                return NextResponse.json({ error: hsError }, { status: contactRes.status >= 500 ? 503 : 422 });
            }
        }

        if (!contactId && contactRes.ok) {
            const contactBody = (await contactRes.json().catch(() => ({}))) as { id?: string };
            contactId = contactBody?.id ?? null;
        }

        /* ----- Create Note on Contact ----- */
        if (contactId) {
            const noteBody = buildContactNote(lead);
            try {
                await hubspotFetch('https://api.hubapi.com/crm/v3/objects/notes', {
                    method: 'POST',
                    body: JSON.stringify({
                        properties: {
                            hs_timestamp: new Date().toISOString(),
                            hs_note_body: noteBody,
                        },
                        associations: [{
                            to: { id: contactId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }],
                        }],
                    }),
                });
            } catch {
                // Note creation is best-effort
            }
        }

        if (mode === 'contact') {
            return NextResponse.json({ ok: true, contactId });
        }

        /* ----- Get default pipeline/stage if not provided ----- */
        let pipelineId = compactString(lead.pipelineId);
        let stageId = compactString(lead.stageId);

        if (!pipelineId || !stageId) {
            const pipelinesRes = await hubspotFetch('https://api.hubapi.com/crm/v3/pipelines/deals', { method: 'GET' });
            if (pipelinesRes.ok) {
                const pipBody = (await pipelinesRes.json().catch(() => ({}))) as {
                    results?: Array<{ id?: string; stages?: Array<{ id?: string }> }>;
                };
                const firstPipeline = pipBody.results?.[0];
                if (firstPipeline) {
                    pipelineId = pipelineId ?? firstPipeline.id ?? null;
                    stageId = stageId ?? firstPipeline.stages?.[0]?.id ?? null;
                }
            }
        }

        if (!stageId) {
            return NextResponse.json({
                ok: true,
                contactId,
                warning: 'Contato enviado, mas negociação não criada: nenhum pipeline/estágio encontrado no HubSpot.',
            });
        }

        /* ----- Create Deal ----- */
        const dealName = compactString(lead.dealName) ?? `${lead.name} - Oportunidade Precision`;
        const dealValue = lead.dealValue ?? (typeof lead.score === 'number' ? lead.score * 100 : undefined);

        const dealProperties: Record<string, string> = {
            dealname: dealName,
            dealstage: stageId,
        };
        if (pipelineId) dealProperties.pipeline = pipelineId;
        if (dealValue != null) dealProperties.amount = String(dealValue);
        if (compactString(lead.ownerId)) dealProperties.hubspot_owner_id = lead.ownerId!;

        const dealPayload: Record<string, unknown> = {
            properties: dealProperties,
        };

        // Associate contact if we have one
        if (contactId) {
            dealPayload.associations = [{
                to: { id: contactId },
                types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
            }];
        }

        let dealRes = await hubspotFetch('https://api.hubapi.com/crm/v3/objects/deals', {
            method: 'POST',
            body: JSON.stringify(dealPayload),
        });

        if (!dealRes.ok) {
            // Retry with minimal deal
            dealRes = await hubspotFetch('https://api.hubapi.com/crm/v3/objects/deals', {
                method: 'POST',
                body: JSON.stringify({
                    properties: { dealname: dealName, dealstage: stageId },
                    ...(contactId ? {
                        associations: [{
                            to: { id: contactId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }],
                        }],
                    } : {}),
                }),
            });
        }

        if (!dealRes.ok) {
            const errBody = await dealRes.json().catch(() => ({}));
            const hsError = getErrorMessage(errBody, `HubSpot deals retornou ${dealRes.status}`);
            const { logger } = await import('@/lib/logger');
            logger.warn('HubSpot deal creation rejected', { status: dealRes.status, error: hsError });

            return NextResponse.json({
                ok: true,
                contactId,
                warning: `Contato enviado, mas falhou ao criar negociação: ${hsError}`,
            });
        }

        const dealBody = (await dealRes.json().catch(() => ({}))) as { id?: string };
        const dealId = dealBody?.id ?? null;

        return NextResponse.json({ ok: true, contactId, dealId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('HubSpot send error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
