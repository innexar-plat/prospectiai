import {
    buildSerperQueries,
    getGeocodeCountry,
    getPlacesLocale,
    buildCompanyAnalysisPrompt,
} from '@/modules/company-analysis/application/company-analysis-locale';
import type { CompanyAnalysisInput } from '@/modules/company-analysis/domain/types';

const baseInput: CompanyAnalysisInput = {
    companyName: 'Acme Barbershop',
    city: 'Orlando',
    state: 'FL',
};

describe('company-analysis-locale', () => {
    describe('getGeocodeCountry', () => {
        it('returns United States for US market', () => {
            expect(getGeocodeCountry('US')).toBe('United States');
        });

        it('returns Brasil for BR market', () => {
            expect(getGeocodeCountry('BR')).toBe('Brasil');
        });
    });

    describe('getPlacesLocale', () => {
        it('uses en/US for US market default', () => {
            expect(getPlacesLocale('US')).toEqual({ languageCode: 'en', regionCode: 'US' });
        });

        it('uses pt-BR region US when UI locale is pt on US market', () => {
            expect(getPlacesLocale('US', 'pt')).toEqual({ languageCode: 'pt-BR', regionCode: 'US' });
        });

        it('uses pt-BR/BR for BR market', () => {
            expect(getPlacesLocale('BR')).toEqual({ languageCode: 'pt-BR', regionCode: 'BR' });
        });
    });

    describe('buildSerperQueries', () => {
        it('builds English queries without Reclame Aqui for US market', () => {
            const queries = buildSerperQueries(baseInput, 'US');
            expect(queries[0]).toContain('Google reviews');
            expect(queries[1]).toContain('complaints');
            expect(queries[2]).toContain('BBB');
            expect(queries.join(' ').toLowerCase()).not.toContain('reclame aqui');
        });

        it('builds Portuguese queries with Reclame Aqui for BR market', () => {
            const queries = buildSerperQueries(baseInput, 'BR');
            expect(queries[0]).toContain('Reclame Aqui');
            expect(queries[1]).toContain('avaliações Google');
        });
    });

    describe('buildCompanyAnalysisPrompt', () => {
        it('generates English prompt for US market with en locale', () => {
            const prompt = buildCompanyAnalysisPrompt('profile', 'web', 'places', true, 'US', 'en');
            expect(prompt).toContain('United States');
            expect(prompt).toContain('Respond ONLY in English');
            expect(prompt).not.toContain('reclameAquiSummary');
        });

        it('generates Portuguese prompt for US market when UI locale is pt', () => {
            const prompt = buildCompanyAnalysisPrompt('profile', 'web', 'places', true, 'US', 'pt');
            expect(prompt).toContain('Estados Unidos');
            expect(prompt).toContain('Português');
            expect(prompt).toContain('Você é um consultor');
            expect(prompt).not.toContain('reclameAquiSummary');
        });

        it('generates Portuguese prompt for BR market with reclameAqui field', () => {
            const prompt = buildCompanyAnalysisPrompt('profile', 'web', 'places', true, 'BR', 'pt');
            expect(prompt).toContain('Brasil');
            expect(prompt).toContain('reclameAquiSummary');
            expect(prompt).toContain('Português');
        });
    });
});
