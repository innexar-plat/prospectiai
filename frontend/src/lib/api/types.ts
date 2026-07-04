import type { SupportedLocale } from '@/lib/locale';

export interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    plan: 'FREE' | 'TRIAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'SCALE';
    leadsUsed: number;
    leadsLimit: number;
    companyName?: string | null;
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    primaryCnaeCode?: string | null;
    primaryCnaeDescription?: string | null;
    companySize?: string | null;
    foundingDate?: string | null;
    productService?: string | null;
    targetAudience?: string | null;
    mainBenefit?: string | null;
    postalCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    serviceModel?: string | null;
    averageTicket?: number | null;
    operationRadiusKm?: number | null;
    knownCompetitors?: string | null;
    phone?: string | null;
    address?: string | null;
    linkedInUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    requiresOnboarding?: boolean;
    emailVerified?: boolean;
    twoFactorEnabled?: boolean;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
    billingCycle?: 'monthly' | 'annual' | null;
    gracePeriodEnd?: string | null;
    pendingPlanId?: string | null;
    pendingPlanEffectiveAt?: string | null;
    notifyByEmail?: boolean;
    autoProspeccaoEnabled?: boolean;
    isTrialing?: boolean;
    trialExpired?: boolean;
    trialDaysRemaining?: number | null;
    starterPromoEligible?: boolean;
    starterPromo?: StarterPromoInfo | null;
}

export type UserProfileUpdate = Partial<Pick<SessionUser,
    'name' | 'phone' | 'address' | 'linkedInUrl' | 'instagramUrl' | 'facebookUrl' | 'websiteUrl' | 'image'
    | 'notifyByEmail'>>;

export interface UserProfileResponse {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    phone: string | null;
    address: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    notifyByEmail: boolean;
}

export interface Place {
    id: string;
    displayName?: { text: string; languageCode?: string };
    formattedAddress?: string;
    nationalPhoneNumber?: string;
    internationalPhoneNumber?: string;
    websiteUri?: string;
    website?: string;
    email?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    primaryType?: string;
    businessStatus?: string;
    opportunityScore?: number;
    cnpj?: string;
    companyLegalName?: string;
    companyTradeName?: string;
    companyMainCnae?: string;
    cnpjStatus?: string;
    phones?: string[];
    emails?: string[];
    websites?: string[];
    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };
    reviews?: Array<{
        rating: number;
        text?: { text: string };
        authorAttribution?: { displayName: string };
        relativePublishTimeDescription?: string;
    }>;
    rfData?: {
        porte: string | null;
        capitalSocial: number | null;
        email: string | null;
        cep: string | null;
        dataAbertura: string | null;
        cnaePrincipal: string | null;
        cnaeDescricao: string | null;
    };
}

export type PlaceDetail = Place & {
    regularOpeningHours?: unknown;
    editorialSummary?: { text: string };
    website?: string;
    primaryType?: string;
    reviews?: Array<{
        rating: number;
        text?: { text: string };
        authorAttribution?: { displayName: string };
        relativePublishTimeDescription?: string;
    }>;
};

export interface Analysis {
    placeId?: string;
    name?: string;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    opportunities?: string[];
    reviewAnalysis?: string;
    reviewTrend?: string;
    suggestedContactTime?: string;
    contactStrategy?: string;
    fullReport?: string;
    socialMedia?: { instagram?: string; facebook?: string; linkedin?: string };
    firstContactMessage?: string;
    suggestedWhatsAppMessage?: string;
    scoreLabel?: string;
    painPoints?: string[];
    gaps?: string[];
    aiProvider?: string;
    [key: string]: unknown;
}

export interface Lead {
    id: string;
    placeId: string;
    name: string;
    address?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    types?: string[];
    businessStatus?: string;
    analysis?: Analysis;
    isFavorite?: boolean;
    createdAt: string;
}

export interface SearchHistoryItem {
    id: string;
    textQuery: string;
    pageSize: number;
    filters?: Record<string, unknown>;
    resultsCount: number;
    resultsData?: Place[];
    city?: string | null;
    state?: string | null;
    country?: string | null;
    createdAt: string;
    user?: { name: string | null; email: string | null };
}

export interface CompetitorRankEntry {
    position: number;
    id: string;
    name: string;
    rating?: number;
    reviewCount?: number;
}

export interface CompetitorAnalysisResult {
    totalCount: number;
    rankingByRating: CompetitorRankEntry[];
    rankingByReviews: CompetitorRankEntry[];
    digitalPresence: {
        withWebsite: number;
        withoutWebsite: number;
        withPhone: number;
        withoutPhone: number;
    };
    opportunities: Array<{ id: string; name: string; missingWebsite: boolean; missingPhone: boolean }>;
    avgRating: number | null;
    medianReviews: number;
    topOpportunities: ScoredPlace[];
    aiPlaybook: AiPlaybook | null;
}

export interface ScoredPlace {
    id: string;
    name: string;
    score: number;
    scoreFactors: Record<string, boolean>;
    formattedAddress?: string;
    phone?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
    primaryType?: string;
}

export interface AiPlaybook {
    entryBarrier: 'alto' | 'medio' | 'baixo';
    entryBarrierExplanation: string;
    marketSummary: string;
    seoChecklist: string[];
    reviewStrategy: string[];
    quickWins: string[];
}

export interface AiMarketInsights {
    executiveSummary: string;
    marketTrends: string[];
    opportunities: string[];
    recommendations: string[];
}

export interface MarketReport {
    totalBusinesses: number;
    segments: Array<{ type: string; count: number; avgRating: number | null }>;
    digitalMaturity: {
        withWebsite: number;
        withPhone: number;
        total: number;
        withWebsitePercent: number;
        withPhonePercent: number;
    };
    saturationIndex: number;
    avgRating: number | null;
    topOpportunities: ScoredPlace[];
    aiInsights: AiMarketInsights | null;
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
    verdictKey?: 'HIGHLY_VIABLE' | 'VIABLE_WITH_CAVEATS' | 'MODERATE' | 'RISKY' | 'NOT_RECOMMENDED';
    goNoGo: 'GO' | 'CAUTION' | 'NO_GO';
    summary: string;
    competitorDensity: number;
    saturationIndex: number;
    digitalMaturityPercent: number;
    strengths: string[];
    risks: string[];
    recommendations: string[];
    estimatedInvestment: string;
    bestLocations: string[];
    segmentBreakdown: SegmentBreakdown[];
    dailyLeadsTarget: number;
    suggestedOffer: string;
    suggestedTicket: string;
    topOpportunities: ScoredPlace[];
}

export interface IntelligenceReportItem {
    id: string;
    module: string;
    inputQuery: string;
    inputCity?: string;
    inputState?: string;
    isFavorite: boolean;
    createdAt: string;
}

export interface PlanFromApi {
    key: string;
    name: string;
    leadsLimit: number;
    priceMonthlyBrl: number;
    priceAnnualBrl: number;
    priceMonthlyUsd?: number;
    priceAnnualUsd?: number;
    currency?: 'BRL' | 'USD';
    modules: string[];
    promo?: StarterPromoInfo;
}

export type StarterPromoInfo = {
    id: string;
    planId: string;
    planKey: string;
    priceMonthlyBrl: number;
    regularPriceMonthlyBrl: number;
    months: number;
    eligible: boolean;
};

export type PromoValidateResponse = {
    eligible: boolean;
    promo: StarterPromoInfo;
    planKey: string;
    priceMonthlyBrl: number;
    regularPriceMonthlyBrl: number;
    months: number;
    checkoutPlanId: string;
    error?: string;
    reason?: string;
};

export type CheckoutResponse =
    | { url: string; scheduled?: false }
    | { url: null; scheduled: true; message: string; pendingPlanEffectiveAt?: string };

export type AnalyzeProgressStep = 'profile' | 'web_search' | 'conversion' | 'prompt' | 'ai_call' | 'parsing' | 'saving' | 'done';

export interface AnalyzeStreamCallbacks {
    onProgress: (step: AnalyzeProgressStep, detail?: string) => void;
    onResult: (result: Analysis) => void;
    onError: (error: string) => void;
}

export interface AnalyzeStreamOptions {
    locale?: SupportedLocale;
    t?: (key: string, options?: Record<string, unknown>) => string;
}

export type ViabilityMode = 'new_business' | 'expand' | 'my_business';

export interface ViabilityAnalyzeParams {
    mode: ViabilityMode;
    businessType?: string;
    city: string;
    state?: string;
    country?: string;
    locale?: string;
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

export interface CompanyAnalysisParams {
    useProfile?: boolean;
    companyName?: string;
    legalName?: string;
    tradeName?: string;
    cnpj?: string;
    city?: string;
    state?: string;
    country?: string;
    locale?: SupportedLocale;
    postalCode?: string;
    neighborhood?: string;
    primaryCnaeCode?: string;
    primaryCnaeDescription?: string;
    companySize?: string;
    foundingDate?: string;
    productService?: string;
    targetAudience?: string;
    mainBenefit?: string;
    address?: string;
    websiteUrl?: string;
    linkedInUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    serviceModel?: string;
    averageTicket?: number;
    operationRadiusKm?: number;
    knownCompetitors?: string;
}

export type NotificationType = 'INFO' | 'ALERT' | 'REMINDER' | 'SYSTEM';

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    link: string | null;
    readAt: string | null;
    createdAt: string;
}

export interface LeadTagItem {
    id: string;
    userId: string;
    leadId: string;
    label: string;
    color: string;
    createdAt: string;
}

export interface LeadAnalysisListItem {
    id: string;
    status?: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST';
    score?: number;
    summary?: string;
    painPoints?: string[];
    approach?: string;
    firstContactMessage?: string;
    isFavorite?: boolean;
    suggestedWhatsAppMessage?: string;
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
    conversionReason?: string;
    dealValue?: number;
    lostReason?: string;
    contactedAt?: string;
    convertedAt?: string;
    lostAt?: string;
    createdAt: string;
    lead: Lead;
}

export interface LeadStats {
    total: number;
    highScore: number;
    favorites: number;
    searchesThisMonth: number;
}

export interface PipelineRecommendation {
    rank: number;
    leadId: string;
    leadPlaceId?: string;
    analysisId: string;
    leadName: string;
    phone?: string;
    closeProbability?: number;
    estimatedDealValue?: number;
    bestContactWindow?: string;
    scoreLabel?: string;
    status: string;
    reasons: string[];
    suggestedAction: string;
}

export interface PipelineStats {
    totalActive: number;
    hotLeads: number;
    avgCloseProbability: number;
    pipelineValue: number;
    conversionRate: number | null;
    avgDealValue: number | null;
    avgCycleDays: number | null;
    totalConverted: number;
    totalLost: number;
    topLostReasons: { reason: string; count: number }[];
}

export interface PipelineBrief {
    recommendations: PipelineRecommendation[];
    stats: PipelineStats;
}

export interface ConversionStats {
    totalAnalyzed: number;
    contacted: number;
    converted: number;
    lost: number;
    conversionRate: number | null;
    avgDealValue: number | null;
    totalRevenue: number | null;
    avgCycleDays: number | null;
    topLostReasons: { reason: string; count: number }[];
    topConvertingTypes: { type: string; count: number }[];
    convertedWithoutWebsite: number | null;
    convertedWithoutPhone: number | null;
}

export interface WorkspaceProfile {
    companyName: string | null;
    legalName: string | null;
    tradeName: string | null;
    cnpj: string | null;
    primaryCnaeCode: string | null;
    primaryCnaeDescription: string | null;
    companySize: string | null;
    foundingDate: string | null;
    productService: string | null;
    targetAudience: string | null;
    mainBenefit: string | null;
    address: string | null;
    postalCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    serviceModel: string | null;
    averageTicket: number | null;
    operationRadiusKm: number | null;
    knownCompetitors: string | null;
}

export interface WorkspaceProfileCnpjLookup {
    cnpj: string;
    legalName: string | null;
    tradeName: string | null;
    primaryCnaeCode: string | null;
    primaryCnaeDescription: string | null;
    companySize: string | null;
    foundingDate: string | null;
    postalCode: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
}

export interface CnaeCode {
    code: string;
    description: string;
}

export interface RfCompanyResult {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    cnaePrincipal: string;
    cnaeDescricao: string | null;
    uf: string;
    municipio: string | null;
    cep: string | null;
    bairro: string | null;
    logradouro: string | null;
    numero: string | null;
    telefone: string | null;
    email: string | null;
    porte: string | null;
    capitalSocial: number | null;
    dataAbertura: string | null;
}

export interface RelatedCompany {
    cnpj: string;
    name: string;
    tradeName: string | null;
    cnae: string | null;
    city: string | null;
    uf: string | null;
    phone: string | null;
    email: string | null;
    capitalSocial: number | null;
    porte: string | null;
    relation: string;
    relevance: number;
}

export interface SmartRelationsResult {
    lead: { placeId: string; name: string; cnpj: string | null };
    relations: RelatedCompany[];
    clusters: {
        sameSector: RelatedCompany[];
        sameRegion: RelatedCompany[];
        contactNetwork: RelatedCompany[];
        userLeads: RelatedCompany[];
    };
    stats: {
        totalFound: number;
        sameSector: number;
        sameRegion: number;
        contactNetwork: number;
        userLeads: number;
    };
}

export interface AutoProspStats {
    totalLeads: number;
    leadsHot: number;
    leadsWarm: number;
    leadsCold: number;
    leadsConverted: number;
    emailsSent: number;
    crmPushed: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    isActive: boolean;
    runsLast7d: number;
}

export interface AutoProspLead {
    id: string;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    email: string | null;
    telefone: string | null;
    ddd: string | null;
    cnaePrincipal: string | null;
    uf: string | null;
    municipio: string | null;
    porte: string | null;
    score: number | null;
    status: string;
    aiAnalysisSummary: string | null;
    crmPushedAt: string | null;
    crmProvider: string | null;
    createdAt: string;
    emailEvents: Array<{
        id: string;
        step: number;
        subject: string;
        sentAt: string | null;
        openedAt: string | null;
        clickedAt: string | null;
    }>;
}

export interface AutoProspRun {
    id: string;
    workspaceId: string;
    triggeredBy: string;
    status: string;
    leadsFound: number;
    leadsAnalyzed: number;
    leadsHot: number;
    leadsWarm: number;
    leadsCold: number;
    emailsQueued: number;
    crmPushed: number;
    startedAt: string;
    completedAt: string | null;
    errorLog: string | null;
    searchProfile: { id: string; name: string } | null;
}

export interface AutoProspProfile {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    cnae: string | null;
    cnaeList: string[] | null;
    uf: string[] | null;
    porte: string[] | null;
    hasEmail: boolean | null;
    totalFound: number;
    totalHot: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
}

export interface AutoProspConfig {
    id: string;
    isActive: boolean;
    scheduleDays: number[];
    scheduleTimeStart: string;
    scheduleTimeEnd: string;
    maxLeadsPerRun: number;
    maxEmailsPerDay: number;
    maxCrmPushPerDay: number;
    hotScoreMin: number;
    warmScoreMin: number;
    crmAutoSend: boolean;
    crmProvider: string | null;
    emailAutoSend: boolean;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export type AffiliateMe = {
    id: string;
    code: string;
    status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
    commissionRatePercent: number;
    payoutType: string | null;
    approvedAt: string | null;
    createdAt: string;
    referralCount: number;
    commissionCount: number;
};

export type AffiliateStats = {
    referralCount: number;
    convertedCount: number;
    commissionPendingCents: number;
    commissionPaidCents: number;
};


