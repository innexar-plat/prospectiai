/**
 * Company analysis module — domain types.
 * Input from workspace profile + optional overrides; output is the report persisted in IntelligenceReport.
 */

export interface CompanyAnalysisInput {
    companyName: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    primaryCnaeCode?: string;
    primaryCnaeDescription?: string;
    companySize?: string;
    foundingDate?: string;
    productService?: string;
    targetAudience?: string;
    mainBenefit?: string;
    address?: string;
    postalCode?: string;
    neighborhood?: string;
    websiteUrl?: string;
    linkedInUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    serviceModel?: string;
    averageTicket?: number;
    operationRadiusKm?: number;
    knownCompetitors?: string;
    /** Overrides from request body */
    city?: string;
    state?: string;
    country?: string;
}

export interface CompanyAnalysisReport {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    reclameAquiSummary?: string;
    googlePresenceScore?: number;
    googleRating?: number;
    googleReviewCount?: number;
    googleReviewsSnippets?: string[];
    socialNetworks: {
        presence: string;
        perNetwork?: Array<{
            network: string;
            link?: string;
            found?: string;
            suggestions?: string;
        }>;
        consistency?: string;
        recommendations?: string[];
    };
    suggestedNiche?: string;
    suggestedBusinessModel?: string;
    recommendations: string[];
}
