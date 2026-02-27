/**
 * Scoring module — unified Opportunity Score engine (0–100).
 * Reused by Competitors, Market and Viability modules.
 *
 * Higher score = easier to close / bigger opportunity for the user.
 */

import type { ScoreFactors, ScoredPlace } from '../domain/types';

/** Weights for each scoring factor (must sum to ~100 max). */
const WEIGHTS = {
    noWebsite: 25,
    noPhone: 15,
    lowRating: 15,
    fewReviews: 20,
    lowReviewsVsMedian: 10,
    mobilePhoneAvailable: 5,
    operational: 5,
    // reserved for future: missingPhotos: 5
};

const LOW_RATING_THRESHOLD = 3.5;
const FEW_REVIEWS_THRESHOLD = 10;

/** Brazilian mobile phone pattern: +55 XX 9xxxx-xxxx or (XX) 9xxxx-xxxx */
const BR_MOBILE_RE = /(?:\+55\s*)?(?:\(?\d{2}\)?\s*)?9\d{4}[\s-]?\d{4}/;

export interface PlaceLikeForScoring {
    id?: string;
    name?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    websiteUri?: string;
    website?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    phone?: string;
    rating?: number;
    userRatingCount?: number;
    reviewCount?: number;
    primaryType?: string;
    types?: string[];
    businessStatus?: string;
}

function getPhone(p: PlaceLikeForScoring): string {
    return (p.nationalPhoneNumber || p.internationalPhoneNumber || p.phone || '').trim();
}

function getWebsite(p: PlaceLikeForScoring): string {
    return (p.websiteUri || p.website || '').trim();
}

function getReviewCount(p: PlaceLikeForScoring): number {
    return p.userRatingCount ?? p.reviewCount ?? 0;
}

function getName(p: PlaceLikeForScoring): string {
    return (p.displayName?.text || p.name || '').trim();
}

/**
 * Compute score factors for a single place.
 * @param medianReviews - median review count of the top competitors (for relative comparison)
 */
export function computeFactors(place: PlaceLikeForScoring, medianReviews = 0): ScoreFactors {
    const website = getWebsite(place);
    const phone = getPhone(place);
    const rating = place.rating ?? 0;
    const reviews = getReviewCount(place);

    return {
        noWebsite: !website,
        noPhone: !phone,
        lowRating: rating > 0 && rating < LOW_RATING_THRESHOLD,
        fewReviews: reviews < FEW_REVIEWS_THRESHOLD,
        lowReviewsVsMedian: medianReviews > 0 && reviews < medianReviews * 0.3,
        mobilePhoneAvailable: BR_MOBILE_RE.test(phone),
        operational: (place.businessStatus ?? 'OPERATIONAL') === 'OPERATIONAL',
    };
}

/** Compute a 0–100 opportunity score from factors. */
export function computeScore(factors: ScoreFactors): number {
    let score = 0;
    if (factors.noWebsite) score += WEIGHTS.noWebsite;
    if (factors.noPhone) score += WEIGHTS.noPhone;
    if (factors.lowRating) score += WEIGHTS.lowRating;
    if (factors.fewReviews) score += WEIGHTS.fewReviews;
    if (factors.lowReviewsVsMedian) score += WEIGHTS.lowReviewsVsMedian;
    if (factors.mobilePhoneAvailable) score += WEIGHTS.mobilePhoneAvailable;
    if (factors.operational) score += WEIGHTS.operational;
    return Math.min(100, Math.max(0, score));
}

/**
 * Score an array of places and return them sorted by score (highest first).
 * @param places raw place objects (from Google Places or local DB)
 * @param topN   max number of scored places to return (default: 20)
 */
export function scoreAndRankPlaces(
    places: PlaceLikeForScoring[],
    topN = 20
): { scored: ScoredPlace[]; medianReviews: number; avgRating: number | null } {
    // Compute median of top 10 review counts for relative comparison
    const reviewCounts = places
        .map((p) => getReviewCount(p))
        .filter((c) => c > 0)
        .sort((a, b) => b - a);
    const top10Reviews = reviewCounts.slice(0, 10);
    const medianReviews =
        top10Reviews.length > 0
            ? top10Reviews[Math.floor(top10Reviews.length / 2)]
            : 0;

    // Compute avg rating
    const ratings = places.map((p) => p.rating).filter((r): r is number => r != null && r > 0);
    const avgRating = ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;

    // Score all places
    const scored: ScoredPlace[] = places
        .map((p) => {
            const factors = computeFactors(p, medianReviews);
            return {
                id: String(p.id ?? ''),
                name: getName(p),
                score: computeScore(factors),
                scoreFactors: factors,
                formattedAddress: p.formattedAddress,
                phone: getPhone(p) || undefined,
                website: getWebsite(p) || undefined,
                rating: p.rating ?? undefined,
                reviewCount: getReviewCount(p) || undefined,
                primaryType: p.primaryType ?? (Array.isArray(p.types) ? p.types[0] : undefined),
            };
        })
        .filter((p) => p.id && p.name)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);

    return { scored, medianReviews, avgRating };
}
