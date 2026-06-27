import {
    buildViabilityAnalysisPrompt,
    buildViabilityFallbackReport,
    buildViabilityTextQuery,
} from '@/lib/ai/prompts/intelligence';

describe('viability intelligence prompts', () => {
    it('builds English text query for US market', () => {
        expect(buildViabilityTextQuery('en', 'Restaurant', 'Austin', 'TX')).toBe('Restaurant in Austin, TX');
    });

    it('builds Portuguese text query for BR market', () => {
        expect(buildViabilityTextQuery('pt', 'Pizzaria', 'Santos', 'SP')).toBe('Pizzaria em Santos, SP');
    });

    it('includes English response language and verdictKey in prompt', () => {
        const prompt = buildViabilityAnalysisPrompt(
            'en',
            'new_business',
            { businessType: 'Gym', city: 'Miami', state: 'FL' },
            {
                businessType: 'Gym',
                city: 'Miami',
                state: 'FL',
                totalCompetitors: 10,
                top3ByRating: 'A (4.5★)',
                top3ByReviews: 'B (20 reviews)',
                withWebsite: 3,
                withoutWebsite: 7,
                withPhone: 8,
                withoutPhone: 2,
                opportunitiesCount: 5,
                segments: 'gym: 10',
                digitalMaturityPercent: 30,
                saturationIndex: 5,
                avgRating: 4.2,
                topScoredCount: 4,
                avgScore: 55,
            },
            undefined,
        );
        expect(prompt).toContain('verdictKey');
        expect(prompt).toContain('English');
        expect(prompt).not.toContain('Viável com Ressalvas');
    });

    it('returns English fallback copy', () => {
        const fallback = buildViabilityFallbackReport('en', 'Denver');
        expect(fallback.verdict).toBe('Partial analysis');
        expect(fallback.verdictKey).toBe('MODERATE');
        expect(fallback.summary).toContain('Could not generate');
        expect(fallback.bestLocations).toEqual(['Denver']);
    });
});
