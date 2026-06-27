/** Viability module — domain types */

import type { ScoredPlace } from '@/modules/scoring';
import type { SupportedLocale } from '@/lib/market';

export type ViabilityVerdictKey =
    | 'HIGHLY_VIABLE'
    | 'VIABLE_WITH_CAVEATS'
    | 'MODERATE'
    | 'RISKY'
    | 'NOT_RECOMMENDED';

export type ViabilityMode = 'new_business' | 'expand' | 'my_business';

export interface ViabilityInput {
    mode: ViabilityMode;
    businessType: string;
    city: string;
    state?: string;
    country?: string;
    locale?: SupportedLocale;
    businessContext?: {
        companyName?: string;
        legalName?: string;
        tradeName?: string;
        cnpj?: string;
        primaryCnaeCode?: string;
        primaryCnaeDescription?: string;
        companySize?: string;
        foundingDate?: string;
        targetAudience?: string;
        mainBenefit?: string;
        serviceModel?: string;
        averageTicket?: number;
        operationRadiusKm?: number;
        knownCompetitors?: string;
    };
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
    verdictKey?: ViabilityVerdictKey;
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
