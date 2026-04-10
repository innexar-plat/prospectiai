import { prisma } from './prisma';
import { PlaceResult } from './google-places';
import {
    extractCnpjFromText,
    fetchCnpjFromBrasilApi,
    normalizeCnpj,
    type CnpjEnrichmentData,
} from './brasilapi-cnpj';
import { fuzzyMatchRfCompany, type RfFuzzyMatchResult } from './rf-fuzzy-match';

/**
 * Compute an opportunity score (0-100) based on lead signals.
 * Higher score = more likely to benefit from outreach.
 */
export function computeOpportunityScore(place: PlaceResult): { score: number; factors: Record<string, boolean> } {
    let score = 0;
    const factors: Record<string, boolean> = {};

    // No website → high opportunity (needs digital presence)
    if (!place.websiteUri) {
        score += 30;
        factors.noWebsite = true;
    }

    // Few or no reviews → needs reputation building
    const reviews = place.userRatingCount ?? 0;
    if (reviews < 10) {
        score += 20;
        factors.fewReviews = true;
    }

    // Low rating → pain point
    if (place.rating != null && place.rating < 3.5) {
        score += 20;
        factors.lowRating = true;
    }

    // No phone → accessibility gap
    if (!place.nationalPhoneNumber && !place.internationalPhoneNumber) {
        score += 15;
        factors.noPhone = true;
    }

    // Not currently open / no hours data → possible inactive
    if (!place.currentOpeningHours?.weekdayDescriptions?.length) {
        score += 10;
        factors.noHoursData = true;
    }

    // No photos → poor online presence
    if (!place.photos?.length) {
        score += 5;
        factors.noPhotos = true;
    }

    return { score: Math.min(100, score), factors };
}

/**
 * Enrich a lead using local RfCompany data first, then fall back to BrasilAPI.
 * Returns enrichment data and the email from RF if available.
 */
async function enrichFromLocalRf(cnpj: string): Promise<{
    enrichment: CnpjEnrichmentData | null;
    rfEmail: string | null;
    rfPorte: string | null;
    rfCapitalSocial: number | null;
}> {
    const rf = await prisma.rfCompany.findUnique({ where: { cnpj } }).catch(() => null);
    if (rf) {
        // Get CNAE description
        const cnaeDesc = rf.cnaePrincipal
            ? await prisma.cnaeCode.findUnique({ where: { code: rf.cnaePrincipal } }).catch(() => null)
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
            rfPorte: rf.porte,
            rfCapitalSocial: rf.capitalSocial,
        };
    }
    return { enrichment: null, rfEmail: null, rfPorte: null, rfCapitalSocial: null };
}

export async function syncLead(place: PlaceResult) {
    try {
        const { score, factors } = computeOpportunityScore(place);
        const existing = await prisma.lead.findUnique({
            where: { placeId: place.id },
            select: { cnpj: true, cnpjLastFetchedAt: true },
        });

        const detectedCnpj =
            normalizeCnpj(existing?.cnpj ?? null)
            ?? extractCnpjFromText(place.displayName.text)
            ?? extractCnpjFromText(place.formattedAddress)
            ?? extractCnpjFromText(place.websiteUri)
            ?? extractCnpjFromText(place.googleMapsUri);

        let enrichment: CnpjEnrichmentData | null = null;
        let rfEmail: string | null = null;
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
            );
            if (fuzzyResult) {
                matchConfidence = fuzzyResult.matchConfidence;
                matchMethod = fuzzyResult.matchMethod;
                rfEmail = fuzzyResult.email;
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

        return await prisma.lead.upsert({
            where: { placeId: place.id },
            update: {
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                email: rfEmail || undefined,
                website: place.websiteUri,
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
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                email: rfEmail || undefined,
                website: place.websiteUri,
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
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error syncing lead', { placeId: place.id, error: error instanceof Error ? error.message : 'Unknown' });
        return null;
    }
}

export async function syncLeads(places: PlaceResult[]) {
    return Promise.all(places.map(syncLead));
}
