/**
 * Shared types for the lead analysis pipeline.
 *
 * These interfaces are used by `gemini.ts` (orchestration), prompt builders,
 * and the analyze service. Extracted for reuse without circular deps.
 */

export interface LeadAnalysisKeyMetric {
    label: string;
    value: string;
    hint?: string;
}

export interface LeadAnalysisMessageChannel {
    short?: string;
    medium?: string;
}

export interface LeadAnalysisMessageVariants {
    whatsapp?: LeadAnalysisMessageChannel;
    email?: LeadAnalysisMessageChannel;
    linkedin?: LeadAnalysisMessageChannel;
}

export interface LeadAnalysis {
    score: number;
    scoreLabel: string;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    painPoints: string[];
    gaps: string[];
    approach: string;
    contactStrategy: string;
    firstContactMessage: string;
    suggestedWhatsAppMessage: string;
    reviewAnalysis?: string;
    reviewTrend?: string;
    suggestedContactTime?: string;
    socialMedia?: {
        instagram?: string;
        facebook?: string;
        linkedin?: string;
    };
    quickActions?: string[];
    messageVariants?: LeadAnalysisMessageVariants;
    keyMetrics?: LeadAnalysisKeyMetric[];
    fullReport: string;
    reclameAquiAnalysis?: string;
    jusBrasilAnalysis?: string;
    cnpjAnalysis?: string;
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
}

export type LeadAnalysisCore = Omit<LeadAnalysis, 'fullReport'>;

export interface UserBusinessProfile {
    companyName: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    primaryCnaeCode?: string;
    primaryCnaeDescription?: string;
    companySize?: string;
    foundingDate?: string;
    productService: string;
    targetAudience: string;
    mainBenefit: string;
    postalCode?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    websiteUrl?: string;
    linkedInUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    serviceModel?: string;
    averageTicket?: number;
    operationRadiusKm?: number;
    knownCompetitors?: string;
}

export interface BusinessData {
    placeId: string;
    name: string;
    formattedAddress?: string;
    address?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    phone?: string;
    websiteUri?: string;
    website?: string;
    rating?: number;
    userRatingCount?: number;
    reviewCount?: number;
    types?: string[];
    businessStatus?: string;
    primaryType?: string;
    hasOpeningHours?: boolean;
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    reviews?: Array<{
        rating: number;
        text: { text: string };
        authorAttribution: { displayName: string };
        relativePublishTimeDescription: string;
    }>;
    cnpj?: string;
    companyLegalName?: string;
    companyTradeName?: string;
    companyPorte?: string;
    companyCapitalSocial?: number;
    companyMainCnae?: string;
    cnpjStatus?: string;
    cnpjOpenedAt?: string;
    rfEmail?: string;
    matchConfidence?: number;
    matchMethod?: string;
}

export interface AnalyzeLeadContext {
    workspaceId: string;
    userId?: string;
}

export type AnalyzeProgressStep =
    | 'profile'
    | 'web_search'
    | 'conversion'
    | 'prompt'
    | 'ai_call'
    | 'parsing'
    | 'saving'
    | 'done';

export type AnalyzeProgressCallback = (step: AnalyzeProgressStep, detail?: string) => void;
