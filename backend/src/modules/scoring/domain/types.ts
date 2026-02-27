/** Scoring module — domain types */

export interface ScoreFactors {
    noWebsite: boolean;
    noPhone: boolean;
    lowRating: boolean;
    fewReviews: boolean;
    lowReviewsVsMedian: boolean;
    mobilePhoneAvailable: boolean;
    operational: boolean;
}

export interface ScoredPlace {
    id: string;
    name: string;
    score: number;
    scoreFactors: ScoreFactors;
    formattedAddress?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    primaryType?: string;
}
