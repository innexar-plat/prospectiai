/**
 * Post-processing for AI lead analysis — removes off-topic industry terms
 * when the model hallucinates a seller niche that does not match the workspace profile.
 */

import type { LeadAnalysisCore, UserBusinessProfile } from './analyze-types';

type IndustryKey =
    | 'real_estate'
    | 'insurance'
    | 'accounting'
    | 'legal'
    | 'marketing'
    | 'technology';

const INDUSTRY_MATCHERS: Record<IndustryKey, RegExp> = {
    real_estate: /imobili[aá]ri|real\s*estate|property\s+(management|sales|listing)|realtor|corretor(?:a)?\s+de\s+im[oó]veis|nova\s+luz/i,
    insurance: /\bseguros?\b|\binsurance\b|corretora\s+de\s+seguros/i,
    accounting: /\bcontabil|accounting\b|escrit[oó]rio\s+de\s+contabilidade/i,
    legal: /\badvocaci|law\s+firm|\blegal\s+services\b|escrit[oó]rio\s+de\s+advocacia/i,
    marketing: /\bag[eê]ncia\s+de\s+marketing\b|\bmarketing\s+digital\b|\bdigital\s+marketing\s+agency\b/i,
    technology: /\bsoftware\b|\btecnologia\b|\btech\s+company\b|\bSaaS\b/i,
};

const INDUSTRY_REPLACEMENT_PATTERNS: Record<IndustryKey, RegExp[]> = {
    real_estate: [
        /\bimobili[aá]ri[aão]?\b/gi,
        /\breal\s+estate\b/gi,
        /\bproperty\s+(management|sales|listings?)\b/gi,
        /\brealtor\b/gi,
        /\bcorretor(?:a)?\s+de\s+im[oó]veis\b/gi,
        /\bnova\s+luz\b/gi,
    ],
    insurance: [/\bseguros?\b/gi, /\binsurance\b/gi, /\bcorretora\s+de\s+seguros\b/gi],
    accounting: [/\bcontabilidade\b/gi, /\baccounting\b/gi, /\bescrit[oó]rio\s+de\s+contabilidade\b/gi],
    legal: [/\badvocacia\b/gi, /\blaw\s+firm\b/gi, /\bescrit[oó]rio\s+de\s+advocacia\b/gi],
    marketing: [/\bag[eê]ncia\s+de\s+marketing\b/gi, /\bmarketing\s+digital\b/gi],
    technology: [/\bempresa\s+de\s+tecnologia\b/gi],
};

function profileIndustryText(profile?: UserBusinessProfile): string {
    return [
        profile?.productService,
        profile?.companyName,
        profile?.tradeName,
        profile?.primaryCnaeDescription,
    ]
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .join(' ');
}

export function sellerMatchesIndustry(profile: UserBusinessProfile | undefined, industry: IndustryKey): boolean {
    const text = profileIndustryText(profile);
    if (!text) return false;
    return INDUSTRY_MATCHERS[industry].test(text);
}

export function getOffTopicIndustryPatterns(profile?: UserBusinessProfile): RegExp[] {
    const patterns: RegExp[] = [];
    for (const industry of Object.keys(INDUSTRY_MATCHERS) as IndustryKey[]) {
        if (!sellerMatchesIndustry(profile, industry)) {
            patterns.push(...INDUSTRY_REPLACEMENT_PATTERNS[industry]);
        }
    }
    return patterns;
}

function replacementForProfile(profile?: UserBusinessProfile): string {
    const service = profile?.productService?.trim();
    if (service) return service;
    const company = profile?.companyName?.trim();
    if (company) return company;
    return 'our offering';
}

export function sanitizeAnalysisText(text: string, profile?: UserBusinessProfile): string {
    if (typeof text !== 'string' || !text.trim()) return text;
    const patterns = getOffTopicIndustryPatterns(profile);
    if (!patterns.length) return text;

    const replacement = replacementForProfile(profile);
    let result = text;
    for (const pattern of patterns) {
        result = result.replace(pattern, replacement);
    }
    return result.replace(/\s{2,}/g, ' ').trim();
}

function sanitizeStringArray(values: string[] | undefined, profile?: UserBusinessProfile): string[] | undefined {
    if (!Array.isArray(values) || !values.length) return values;
    return values.map((item) => (typeof item === 'string' ? sanitizeAnalysisText(item, profile) : item));
}

function sanitizeMessageVariants(
    variants: LeadAnalysisCore['messageVariants'],
    profile?: UserBusinessProfile,
): LeadAnalysisCore['messageVariants'] {
    if (!variants) return variants;
    const sanitizeChannel = (channel?: { short?: string; medium?: string }) => {
        if (!channel) return channel;
        return {
            short: channel.short ? sanitizeAnalysisText(channel.short, profile) : channel.short,
            medium: channel.medium ? sanitizeAnalysisText(channel.medium, profile) : channel.medium,
        };
    };
    return {
        whatsapp: sanitizeChannel(variants.whatsapp),
        email: sanitizeChannel(variants.email),
        linkedin: sanitizeChannel(variants.linkedin),
    };
}

export function sanitizeLeadAnalysisCore(
    analysis: LeadAnalysisCore,
    profile?: UserBusinessProfile,
): LeadAnalysisCore {
    return {
        ...analysis,
        summary: sanitizeAnalysisText(analysis.summary, profile),
        strengths: sanitizeStringArray(analysis.strengths, profile) ?? analysis.strengths,
        weaknesses: sanitizeStringArray(analysis.weaknesses, profile) ?? analysis.weaknesses,
        painPoints: sanitizeStringArray(analysis.painPoints, profile) ?? analysis.painPoints,
        gaps: sanitizeStringArray(analysis.gaps, profile) ?? analysis.gaps,
        approach: sanitizeAnalysisText(analysis.approach, profile),
        contactStrategy: sanitizeAnalysisText(analysis.contactStrategy, profile),
        firstContactMessage: sanitizeAnalysisText(analysis.firstContactMessage, profile),
        suggestedWhatsAppMessage: sanitizeAnalysisText(analysis.suggestedWhatsAppMessage, profile),
        reviewAnalysis: analysis.reviewAnalysis
            ? sanitizeAnalysisText(analysis.reviewAnalysis, profile)
            : analysis.reviewAnalysis,
        reviewTrend: analysis.reviewTrend
            ? sanitizeAnalysisText(analysis.reviewTrend, profile)
            : analysis.reviewTrend,
        suggestedContactTime: analysis.suggestedContactTime
            ? sanitizeAnalysisText(analysis.suggestedContactTime, profile)
            : analysis.suggestedContactTime,
        bestContactWindow: analysis.bestContactWindow
            ? sanitizeAnalysisText(analysis.bestContactWindow, profile)
            : analysis.bestContactWindow,
        quickActions: sanitizeStringArray(analysis.quickActions, profile) ?? analysis.quickActions,
        keyMetrics: analysis.keyMetrics?.map((metric) => ({
            ...metric,
            label: sanitizeAnalysisText(metric.label, profile),
            value: sanitizeAnalysisText(metric.value, profile),
            hint: metric.hint ? sanitizeAnalysisText(metric.hint, profile) : metric.hint,
        })),
        messageVariants: sanitizeMessageVariants(analysis.messageVariants, profile),
        socialMedia: analysis.socialMedia
            ? {
                instagram: analysis.socialMedia.instagram,
                facebook: analysis.socialMedia.facebook,
                linkedin: analysis.socialMedia.linkedin,
            }
            : analysis.socialMedia,
    };
}
