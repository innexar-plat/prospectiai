import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { PlaceResult } from './google-places';
import {
    extractCnpjFromText,
    fetchCnpjFromBrasilApi,
    normalizeCnpj,
    type CnpjEnrichmentData,
} from './brasilapi-cnpj';
import { fuzzyMatchRfCompany, type RfFuzzyMatchResult } from './rf-fuzzy-match';
import { recomputeLeadContactSnapshot } from '@/lib/contact-intelligence';

const DEFAULT_SYNC_LEADS_CONCURRENCY = 4;
const MAX_SYNC_LEADS_CONCURRENCY = 20;

function resolveSyncLeadsConcurrency(): number {
    const raw = Number.parseInt(process.env.SYNC_LEADS_CONCURRENCY ?? '', 10);
    if (!Number.isFinite(raw) || raw < 1) return DEFAULT_SYNC_LEADS_CONCURRENCY;
    return Math.min(MAX_SYNC_LEADS_CONCURRENCY, raw);
}

async function runWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>,
): Promise<R[]> {
    if (items.length === 0) return [];

    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const index = currentIndex;
            currentIndex += 1;
            if (index >= items.length) return;
            results[index] = await worker(items[index]!);
        }
    });

    await Promise.all(workers);
    return results;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
}

function normalizeWebsite(url: string): string {
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.toLowerCase();
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${host}${path}`;
    } catch {
        return url.trim().toLowerCase();
    }
}

async function upsertLeadContact(input: {
    leadId: string;
    type: 'PHONE' | 'EMAIL' | 'WEBSITE';
    source: 'GOOGLE' | 'RECEITA';
    valueRaw: string;
    valueNormalized: string;
    confidenceScore?: number;
    isPrimary?: boolean;
    evidence?: Prisma.InputJsonValue;
}) {
    if (!input.valueNormalized) return;

    await prisma.leadContact.upsert({
        where: {
            leadId_type_valueNormalized_source: {
                leadId: input.leadId,
                type: input.type,
                valueNormalized: input.valueNormalized,
                source: input.source,
            },
        },
        update: {
            valueRaw: input.valueRaw,
            confidenceScore: input.confidenceScore,
            isPrimary: input.isPrimary ?? false,
            evidence: input.evidence,
            lastSeenAt: new Date(),
        },
        create: {
            leadId: input.leadId,
            type: input.type,
            source: input.source,
            valueRaw: input.valueRaw,
            valueNormalized: input.valueNormalized,
            confidenceScore: input.confidenceScore,
            isPrimary: input.isPrimary ?? false,
            evidence: input.evidence,
        },
    });
}

async function syncLeadContacts(leadId: string, input: {
    googlePhone?: string;
    googleWebsite?: string;
    rfEmail?: string | null;
    rfPhone?: string | null;
}) {
    const tasks: Array<Promise<void>> = [];

    if (input.googlePhone) {
        const normalized = normalizePhone(input.googlePhone);
        if (normalized) {
            tasks.push(upsertLeadContact({
                leadId,
                type: 'PHONE',
                source: 'GOOGLE',
                valueRaw: input.googlePhone,
                valueNormalized: normalized,
                confidenceScore: 70,
                isPrimary: true,
                evidence: { sourceField: 'nationalPhoneNumber|internationalPhoneNumber' },
            }));
        }
    }

    if (input.rfPhone) {
        const normalized = normalizePhone(input.rfPhone);
        if (normalized) {
            tasks.push(upsertLeadContact({
                leadId,
                type: 'PHONE',
                source: 'RECEITA',
                valueRaw: input.rfPhone,
                valueNormalized: normalized,
                confidenceScore: 55,
                isPrimary: !input.googlePhone,
                evidence: { sourceField: 'rfCompany.ddd+telefone' },
            }));
        }
    }

    if (input.googleWebsite) {
        const normalized = normalizeWebsite(input.googleWebsite);
        if (normalized) {
            tasks.push(upsertLeadContact({
                leadId,
                type: 'WEBSITE',
                source: 'GOOGLE',
                valueRaw: input.googleWebsite,
                valueNormalized: normalized,
                confidenceScore: 70,
                isPrimary: true,
                evidence: { sourceField: 'websiteUri' },
            }));
        }
    }

    if (input.rfEmail) {
        const normalized = normalizeEmail(input.rfEmail);
        if (normalized) {
            tasks.push(upsertLeadContact({
                leadId,
                type: 'EMAIL',
                source: 'RECEITA',
                valueRaw: input.rfEmail,
                valueNormalized: normalized,
                confidenceScore: 55,
                isPrimary: true,
                evidence: { sourceField: 'rfCompany.email' },
            }));
        }
    }

    await Promise.all(tasks);
}

/**
 * Compute an opportunity score (0-100) based on lead signals.
 * Higher score = more likely to benefit from outreach.
 */
/**
 * Opportunity score (0-100) used to rank search results.
 *
 * need  — how much the business would benefit from what our customers sell (no website,
 *         weak reputation). These add points.
 * reach — whether the lead is actually workable. Missing phone or a closed business used to
 *         ADD points, which pushed unreachable / dead listings to the top of every search;
 *         now they scale the score down (closed permanently = 0).
 * Factor keys are stable (noWebsite, fewReviews, lowRating, noPhone, noHoursData, noPhotos)
 * because the UI renders them as badges.
 */
export function computeOpportunityScore(place: PlaceResult): { score: number; factors: Record<string, boolean> } {
    const factors: Record<string, boolean> = {};
    let need = 0;

    if (!place.websiteUri) {
        need += 35;
        factors.noWebsite = true;
    }

    const reviews = place.userRatingCount ?? 0;
    if (reviews < 10) {
        need += 20;
        factors.fewReviews = true;
    } else if (reviews < 40) {
        need += 8;
    }

    if (place.rating != null && place.rating < 3.5) {
        need += 25;
        factors.lowRating = true;
    } else if (place.rating != null && place.rating < 4.2) {
        need += 10;
    }

    if (!place.photos?.length) {
        need += 5;
        factors.noPhotos = true;
    }

    const hasHours = Boolean(place.currentOpeningHours?.weekdayDescriptions?.length);
    if (hasHours) need += 10; // active, maintained listing
    else factors.noHoursData = true;

    let reach = 1;
    if (!place.nationalPhoneNumber && !place.internationalPhoneNumber) {
        reach *= 0.6;
        factors.noPhone = true;
    }
    if (place.businessStatus === 'CLOSED_TEMPORARILY') {
        reach *= 0.3;
        factors.closedTemporarily = true;
    }
    if (place.businessStatus === 'CLOSED_PERMANENTLY') {
        reach = 0;
        factors.closedPermanently = true;
    }

    return { score: Math.min(100, Math.round(need * reach)), factors };
}

/**
 * Enrich a lead using local RfCompany data first, then fall back to BrasilAPI.
 * Returns enrichment data and the email from RF if available.
 */
async function enrichFromLocalRf(cnpj: string): Promise<{
    enrichment: CnpjEnrichmentData | null;
    rfEmail: string | null;
    rfPhone: string | null;
    rfPorte: string | null;
    rfCapitalSocial: number | null;
}> {
    const rf = await prisma.rfCompany.findUnique({ where: { cnpj } }).catch(() => null);
    if (rf) {
        // Get CNAE description
        const cnaeDesc = rf.cnaePrincipal
            ? await prisma.cnaeCode.findUnique({ where: { code: rf.cnaePrincipal } }).catch(() => null)
            : null;

        // Build full phone from DDD + telefone
        const rfPhone = rf.telefone
            ? (rf.ddd ? `${rf.ddd}${rf.telefone}` : rf.telefone)
            : null;

        return {
            enrichment: {
                cnpj: rf.cnpj,
                companyLegalName: rf.razaoSocial,
                companyTradeName: rf.nomeFantasia || undefined,
                companySize: rf.porte || undefined,
                companyLegalNature: undefined,
                companyMainCnae: cnaeDesc?.description || rf.cnaePrincipal,
                cnpjStatus: 'ATIVA',
                cnpjOpenedAt: rf.dataAbertura || undefined,
            },
            rfEmail: rf.email,
            rfPhone,
            rfPorte: rf.porte,
            rfCapitalSocial: rf.capitalSocial,
        };
    }
    return { enrichment: null, rfEmail: null, rfPhone: null, rfPorte: null, rfCapitalSocial: null };
}

export async function syncLead(place: PlaceResult) {
    try {
        const { score, factors } = computeOpportunityScore(place);
        const existing = await prisma.lead.findUnique({
            where: { placeId: place.id },
            select: { cnpj: true, cnpjLastFetchedAt: true },
        });

        // NOTE: Do NOT extract from googleMapsUri — its numeric CID (14 digits)
        // is misdetected as a CNPJ, polluting the enrichment pipeline.
        const detectedCnpj =
            normalizeCnpj(existing?.cnpj ?? null)
            ?? extractCnpjFromText(place.displayName.text)
            ?? extractCnpjFromText(place.formattedAddress)
            ?? extractCnpjFromText(place.websiteUri);

        let enrichment: CnpjEnrichmentData | null = null;
        let rfEmail: string | null = null;
        let rfPhone: string | null = null;
        let rfPorte: string | null = null;
        let rfCapitalSocial: number | null = null;
        let matchConfidence: number | null = null;
        let matchMethod: string | null = null;

        if (detectedCnpj) {
            matchConfidence = 100;
            matchMethod = 'cnpj_direct';
            const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
            const fetchedAt = existing?.cnpjLastFetchedAt?.getTime() ?? 0;
            const shouldRefresh = !fetchedAt || Date.now() - fetchedAt > maxAgeMs;
            if (shouldRefresh) {
                // Try local RfCompany first (instant), then BrasilAPI as fallback
                const rfResult = await enrichFromLocalRf(detectedCnpj);
                enrichment = rfResult.enrichment;
                rfEmail = rfResult.rfEmail;
                rfPhone = rfResult.rfPhone;
                rfPorte = rfResult.rfPorte;
                rfCapitalSocial = rfResult.rfCapitalSocial;

                if (!enrichment) {
                    enrichment = await fetchCnpjFromBrasilApi(detectedCnpj).catch(() => null);
                }
            }
        } else {
            // F1: Fuzzy name+address matching when no CNPJ is detected
            const fuzzyResult = await fuzzyMatchRfCompany(
                place.displayName.text,
                place.formattedAddress ?? '',
                place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
            );
            if (fuzzyResult) {
                matchConfidence = fuzzyResult.matchConfidence;
                matchMethod = fuzzyResult.matchMethod;
                rfEmail = fuzzyResult.email;
                rfPhone = fuzzyResult.telefone
                    ? (fuzzyResult.ddd ? `${fuzzyResult.ddd}${fuzzyResult.telefone}` : fuzzyResult.telefone)
                    : null;
                rfPorte = fuzzyResult.porte;
                rfCapitalSocial = fuzzyResult.capitalSocial;

                // Get CNAE description
                const cnaeDesc = fuzzyResult.cnaePrincipal
                    ? await prisma.cnaeCode.findUnique({ where: { code: fuzzyResult.cnaePrincipal } }).catch(() => null)
                    : null;

                enrichment = {
                    cnpj: fuzzyResult.cnpj,
                    companyLegalName: fuzzyResult.razaoSocial,
                    companyTradeName: fuzzyResult.nomeFantasia ?? undefined,
                    companySize: fuzzyResult.porte ?? undefined,
                    companyLegalNature: undefined,
                    companyMainCnae: cnaeDesc?.description ?? fuzzyResult.cnaePrincipal ?? undefined,
                    cnpjStatus: 'ATIVA',
                    cnpjOpenedAt: fuzzyResult.dataAbertura ?? undefined,
                };
            }
        }

        const googlePhone = place.nationalPhoneNumber || place.internationalPhoneNumber;
        const googleWebsite = place.websiteUri;

        const upsertedLead = await prisma.lead.upsert({
            where: { placeId: place.id },
            update: {
                name: place.displayName.text,
                address: place.formattedAddress,
            phone: googlePhone,
                email: rfEmail || undefined,
            website: googleWebsite,
            recommendedPhone: googlePhone || undefined,
            recommendedEmail: rfEmail || undefined,
            recommendedWebsite: googleWebsite || undefined,
                cnpj: enrichment?.cnpj ?? detectedCnpj ?? undefined,
                companyLegalName: enrichment?.companyLegalName,
                companyTradeName: enrichment?.companyTradeName,
                companySize: enrichment?.companySize,
                companyPorte: rfPorte || undefined,
                companyLegalNature: enrichment?.companyLegalNature,
                companyMainCnae: enrichment?.companyMainCnae,
                companyCapitalSocial: rfCapitalSocial,
                cnpjStatus: enrichment?.cnpjStatus,
                cnpjOpenedAt: enrichment?.cnpjOpenedAt,
                cnpjLastFetchedAt: enrichment ? new Date() : undefined,
                rating: place.rating,
                reviewCount: place.userRatingCount,
                types: place.types || [],
                businessStatus: place.businessStatus,
                lastSearchedAt: new Date(),
                opportunityScore: score,
                scoreFactors: factors,
                lastScoredAt: new Date(),
                matchConfidence: matchConfidence,
                matchMethod: matchMethod,
            },
            create: {
                placeId: place.id,
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: googlePhone,
                email: rfEmail || undefined,
                website: googleWebsite,
                recommendedPhone: googlePhone || undefined,
                recommendedEmail: rfEmail || undefined,
                recommendedWebsite: googleWebsite || undefined,
                cnpj: enrichment?.cnpj ?? detectedCnpj ?? undefined,
                companyLegalName: enrichment?.companyLegalName,
                companyTradeName: enrichment?.companyTradeName,
                companySize: enrichment?.companySize,
                companyPorte: rfPorte || undefined,
                companyLegalNature: enrichment?.companyLegalNature,
                companyMainCnae: enrichment?.companyMainCnae,
                companyCapitalSocial: rfCapitalSocial,
                cnpjStatus: enrichment?.cnpjStatus,
                cnpjOpenedAt: enrichment?.cnpjOpenedAt,
                cnpjLastFetchedAt: enrichment ? new Date() : undefined,
                rating: place.rating,
                reviewCount: place.userRatingCount,
                types: place.types || [],
                businessStatus: place.businessStatus,
                opportunityScore: score,
                scoreFactors: factors,
                lastScoredAt: new Date(),
                matchConfidence: matchConfidence,
                matchMethod: matchMethod,
            },
        });

        await syncLeadContacts(upsertedLead.id, {
            googlePhone,
            googleWebsite,
            rfEmail,
            rfPhone,
        });

        await recomputeLeadContactSnapshot(upsertedLead.id);

        return upsertedLead;
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error syncing lead', { placeId: place.id, error: error instanceof Error ? error.message : 'Unknown' });
        return null;
    }
}

export async function syncLeads(places: PlaceResult[]) {
    const concurrency = resolveSyncLeadsConcurrency();
    return runWithConcurrencyLimit(places, concurrency, syncLead);
}
