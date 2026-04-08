import { prisma } from './prisma';
import { PlaceResult } from './google-places';
import {
    extractCnpjFromText,
    fetchCnpjFromBrasilApi,
    normalizeCnpj,
    type CnpjEnrichmentData,
} from './brasilapi-cnpj';

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
        if (detectedCnpj) {
            const maxAgeMs = 30 * 24 * 60 * 60 * 1000;
            const fetchedAt = existing?.cnpjLastFetchedAt?.getTime() ?? 0;
            const shouldRefresh = !fetchedAt || Date.now() - fetchedAt > maxAgeMs;
            if (shouldRefresh) {
                enrichment = await fetchCnpjFromBrasilApi(detectedCnpj).catch(() => null);
            }
        }

        return await prisma.lead.upsert({
            where: { placeId: place.id },
            update: {
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                website: place.websiteUri,
                cnpj: enrichment?.cnpj ?? detectedCnpj ?? undefined,
                companyLegalName: enrichment?.companyLegalName,
                companyTradeName: enrichment?.companyTradeName,
                companySize: enrichment?.companySize,
                companyLegalNature: enrichment?.companyLegalNature,
                companyMainCnae: enrichment?.companyMainCnae,
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
            },
            create: {
                placeId: place.id,
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                website: place.websiteUri,
                cnpj: enrichment?.cnpj ?? detectedCnpj ?? undefined,
                companyLegalName: enrichment?.companyLegalName,
                companyTradeName: enrichment?.companyTradeName,
                companySize: enrichment?.companySize,
                companyLegalNature: enrichment?.companyLegalNature,
                companyMainCnae: enrichment?.companyMainCnae,
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
