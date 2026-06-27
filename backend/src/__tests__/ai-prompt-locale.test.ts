/**
 * AI prompt locale helpers and intelligence prompt language rules.
 */
import { NextRequest } from 'next/server';
import { getAiLanguageRule } from '@/lib/ai/prompts/locale';
import { buildCompetitorPlaybookPrompt, buildMarketInsightsPrompt, buildViabilityAnalysisPrompt } from '@/lib/ai/prompts/intelligence';
import { getRequestLocale, resolveAiRequestLocale } from '@/lib/i18n/locale';

describe('AI prompt locale', () => {
    it('getAiLanguageRule returns English-only instruction for en', () => {
        expect(getAiLanguageRule('en')).toContain('Respond ONLY in English');
    });

    it('getAiLanguageRule returns Portuguese instruction for pt', () => {
        expect(getAiLanguageRule('pt')).toContain('Português');
    });

    it('competitor playbook prompt is Portuguese when locale is pt', () => {
        const prompt = buildCompetitorPlaybookPrompt('pt', 'dentistas em Miami', {
            totalCount: 10,
            avgRating: 4.2,
            medianReviews: 5,
            withWebsite: 6,
            withoutWebsite: 4,
            topByRating: 'A (4.8★)',
            topByReviews: 'B (20 reviews)',
            opportunitiesCount: 3,
        });
        expect(prompt).toContain('Português');
        expect(prompt).toContain('Você é um consultor');
        expect(prompt).not.toContain('Respond ONLY in English');
    });

    it('competitor playbook prompt is English when locale is en', () => {
        const prompt = buildCompetitorPlaybookPrompt('en', 'dentists in Miami', {
            totalCount: 10,
            avgRating: 4.2,
            medianReviews: 5,
            withWebsite: 6,
            withoutWebsite: 4,
            topByRating: 'A (4.8★)',
            topByReviews: 'B (20 reviews)',
            opportunitiesCount: 3,
        });
        expect(prompt).toContain('Respond ONLY in English');
        expect(prompt).toContain('digital marketing');
        expect(prompt).not.toContain('Você é um consultor');
    });

    it('market insights prompt is English when locale is en', () => {
        const prompt = buildMarketInsightsPrompt('en', 'restaurants in Austin', {
            totalBusinesses: 25,
            segments: [{ type: 'restaurant', count: 20, avgRating: 4.1 }],
            withWebsitePercent: 40,
            withPhonePercent: 80,
            saturationIndex: 5,
            avgRating: 4.1,
        });
        expect(prompt).toContain('Respond ONLY in English');
        expect(prompt).toContain('market intelligence analyst');
    });

    it('viability prompt is English when locale is en', () => {
        const prompt = buildViabilityAnalysisPrompt(
            'en',
            'new_business',
            { businessType: 'coffee shop', city: 'Miami', state: 'FL' },
            {
                businessType: 'coffee shop',
                city: 'Miami',
                state: 'FL',
                totalCompetitors: 12,
                top3ByRating: 'A',
                top3ByReviews: 'B',
                withWebsite: 5,
                withoutWebsite: 7,
                withPhone: 8,
                withoutPhone: 4,
                opportunitiesCount: 4,
                segments: 'cafe: 5',
                digitalMaturityPercent: 42,
                saturationIndex: 3,
                avgRating: 4.0,
                topScoredCount: 5,
                avgScore: 60,
            },
        );
        expect(prompt).toContain('Respond ONLY in English');
        expect(prompt).toContain('opening a new business');
    });
});

describe('resolveAiRequestLocale', () => {
    it('prefers body locale over header', () => {
        const req = new NextRequest('http://x/api/competitors', {
            method: 'POST',
            headers: { 'X-Locale': 'pt', 'X-Prospector-Market': 'US' },
        });
        expect(resolveAiRequestLocale(req, 'en')).toBe('en');
    });

    it('uses X-Locale header when body locale is missing', () => {
        const req = new NextRequest('http://x/api/competitors', {
            method: 'POST',
            headers: { 'X-Locale': 'en', 'X-Prospector-Market': 'US' },
        });
        expect(resolveAiRequestLocale(req)).toBe('en');
    });

    it('uses X-Locale pt on US market when body locale is missing', () => {
        const req = new NextRequest('http://precisionai.innexar.app/api/competitors', {
            method: 'POST',
            headers: {
                'X-Locale': 'pt',
                'X-Prospector-Market': 'US',
                host: 'precisionai.innexar.app',
            },
        });
        expect(resolveAiRequestLocale(req)).toBe('pt');
    });

    it('falls back to market default on US when no body or X-Locale', () => {
        const req = new NextRequest('http://precisionai.innexar.app/api/competitors', {
            method: 'POST',
            headers: {
                'X-Prospector-Market': 'US',
                host: 'precisionai.innexar.app',
                'accept-language': 'fr-FR,fr;q=0.9',
            },
        });
        expect(resolveAiRequestLocale(req)).toBe('en');
    });

    it('getRequestLocale reads X-Locale before accept-language', () => {
        const req = new NextRequest('http://x/', {
            headers: {
                'X-Locale': 'en',
                'accept-language': 'pt-BR,pt;q=0.9',
                'X-Prospector-Market': 'BR',
            },
        });
        expect(getRequestLocale(req)).toBe('en');
    });
});
