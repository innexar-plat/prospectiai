/** Viability module — domain types */

import type { ScoredPlace } from '@/modules/scoring';

export type ViabilityMode = 'new_business' | 'expand' | 'my_business';

export interface ViabilityInput {
    mode: ViabilityMode;
    businessType: string;
    city: string;
    state?: string;
}

export interface SegmentBreakdown {
    segment: string;
    count: number;
    avgRating: number | null;
    opportunityLevel: 'alta' | 'media' | 'baixa';
}

export interface ViabilityReport {
    score: number;
    verdict: string;
    summary: string;
    goNoGo: 'GO' | 'CAUTION' | 'NO_GO';
    competitorDensity: number;
    saturationIndex: number;
    digitalMaturityPercent: number;
    strengths: string[];
    risks: string[];
    recommendations: string[];
    estimatedInvestment: string;
    bestLocations: string[];
    // Enhanced fields
    segmentBreakdown: SegmentBreakdown[];
    dailyLeadsTarget: number;
    suggestedOffer: string;
    suggestedTicket: string;
    topOpportunities: ScoredPlace[];
}
