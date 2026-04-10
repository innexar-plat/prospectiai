/**
 * Tests for AI prompt builder module.
 */
import {
    buildTaskDescription,
    buildCompanyContext,
    buildLeadAnalysisPrompt,
    buildRfDataBlock,
    buildReviewSignalsText,
    buildOpeningHoursText,
} from '@/lib/ai/prompts/builder';
import type { BusinessData, UserBusinessProfile } from '@/lib/ai/prompts/analyze-types';

describe('AI Prompts Builder', () => {
    describe('buildTaskDescription', () => {
        it('returns English task description', () => {
            const result = buildTaskDescription(true);
            expect(result).toContain('strategic prospecting report');
        });

        it('returns Portuguese task description', () => {
            const result = buildTaskDescription(false);
            expect(result).toContain('relatório estratégico');
        });
    });

    describe('buildCompanyContext', () => {
        it('returns generic context when no profile', () => {
            const result = buildCompanyContext(undefined, true);
            expect(result).toContain('Senior B2B');
        });

        it('includes company details when profile provided', () => {
            const profile: UserBusinessProfile = {
                companyName: 'TestCo',
                productService: 'Software',
                targetAudience: 'SMBs',
                mainBenefit: 'Automation',
            };
            const result = buildCompanyContext(profile, false);
            expect(result).toContain('TestCo');
            expect(result).toContain('Software');
        });
    });

    describe('buildRfDataBlock', () => {
        it('returns empty string when no CNPJ', () => {
            const business: BusinessData = { placeId: 'p1', name: 'Test' };
            expect(buildRfDataBlock(business, true)).toBe('');
        });

        it('includes CNPJ data in English', () => {
            const business: BusinessData = {
                placeId: 'p1',
                name: 'Test',
                cnpj: '12345678000190',
                companyLegalName: 'Test Ltda',
                companyPorte: 'ME',
            };
            const result = buildRfDataBlock(business, true);
            expect(result).toContain('RECEITA FEDERAL DATA');
            expect(result).toContain('12.345.678/0001-90');
            expect(result).toContain('Test Ltda');
        });

        it('includes CNPJ data in Portuguese', () => {
            const business: BusinessData = {
                placeId: 'p1',
                name: 'Test',
                cnpj: '12345678000190',
            };
            const result = buildRfDataBlock(business, false);
            expect(result).toContain('DADOS DA RECEITA FEDERAL');
        });
    });

    describe('buildReviewSignalsText', () => {
        it('returns no-data message when no reviews', () => {
            const result = buildReviewSignalsText(undefined, true);
            expect(result).toContain('no review data');
        });

        it('returns no-negative message when only good reviews', () => {
            const reviews = [
                { rating: 5, text: { text: 'Great' }, authorAttribution: { displayName: 'John' }, relativePublishTimeDescription: '1 week' },
            ];
            const result = buildReviewSignalsText(reviews as BusinessData['reviews'], true);
            expect(result).toContain('No strong negative');
        });

        it('formats negative reviews', () => {
            const reviews = [
                { rating: 2, text: { text: 'Bad service' }, authorAttribution: { displayName: 'Jane' }, relativePublishTimeDescription: '1 day' },
            ];
            const result = buildReviewSignalsText(reviews as BusinessData['reviews'], true);
            expect(result).toContain('Jane');
            expect(result).toContain('Bad service');
            expect(result).toContain('2/5');
        });
    });

    describe('buildOpeningHoursText', () => {
        it('returns unavailable when no hours', () => {
            const result = buildOpeningHoursText(undefined, true);
            expect(result).toContain('not available');
        });

        it('formats opening hours with open status', () => {
            const hours = {
                openNow: true,
                weekdayDescriptions: ['Monday: 9AM-5PM', 'Tuesday: 9AM-5PM'],
            };
            const result = buildOpeningHoursText(hours as BusinessData['currentOpeningHours'], true);
            expect(result).toContain('Open now');
            expect(result).toContain('Monday: 9AM-5PM');
        });

        it('shows closed status in Portuguese', () => {
            const hours = {
                openNow: false,
                weekdayDescriptions: ['Segunda: 9h-17h'],
            };
            const result = buildOpeningHoursText(hours as BusinessData['currentOpeningHours'], false);
            expect(result).toContain('Fechado agora');
        });
    });

    describe('buildLeadAnalysisPrompt', () => {
        it('builds a complete prompt with all sections', () => {
            const result = buildLeadAnalysisPrompt({
                business: { placeId: 'p1', name: 'Coffee Shop', rating: 4.5, primaryType: 'cafe' } as BusinessData,
                isEn: true,
                companyContext: 'We sell marketing services',
                taskDescription: 'You are a lead analyst',
                address: '123 Main St',
                phone: '+5511999999999',
                website: 'https://coffee.com',
                reviewCount: 42,
                reviewsText: 'Great coffee!',
                reviewSignalsText: 'No negative signals',
                openingHoursText: 'Open now',
                webContext: 'Web intel here',
                isBusinessPlan: false,
                conversionContext: 'Conversion data here',
                rfDataBlock: '',
                websiteScrapingBlock: '',
            });

            expect(result).toContain('Coffee Shop');
            expect(result).toContain('LEAD DATA:');
            expect(result).toContain('123 Main St');
            expect(result).toContain('+5511999999999');
            expect(result).toContain('https://coffee.com');
            expect(result).toContain('4.5/5');
            expect(result).toContain('"score"');
            expect(result).toContain('"fullReport"');
        });

        it('uses Portuguese labels when isEn is false', () => {
            const result = buildLeadAnalysisPrompt({
                business: { placeId: 'p1', name: 'Padaria' } as BusinessData,
                isEn: false,
                companyContext: 'Contexto',
                taskDescription: 'Descrição',
                address: 'Rua X',
                phone: '',
                website: '',
                reviewCount: 0,
                reviewsText: 'Nenhuma',
                reviewSignalsText: 'Sem sinais',
                openingHoursText: 'Indisponível',
                webContext: '',
                isBusinessPlan: false,
                conversionContext: '',
                rfDataBlock: '',
                websiteScrapingBlock: '',
            });

            expect(result).toContain('DADOS DO LEAD:');
            expect(result).toContain('SEM WEBSITE');
            expect(result).toContain('Sem telefone cadastrado');
        });

        it('includes extended analysis fields for business plan', () => {
            const result = buildLeadAnalysisPrompt({
                business: { placeId: 'p1', name: 'Test' } as BusinessData,
                isEn: true,
                companyContext: '',
                taskDescription: '',
                address: '',
                phone: '',
                website: '',
                reviewCount: 0,
                reviewsText: '',
                reviewSignalsText: '',
                openingHoursText: '',
                webContext: '',
                isBusinessPlan: true,
                conversionContext: '',
                rfDataBlock: '',
                websiteScrapingBlock: '',
            });

            expect(result).toContain('reclameAquiAnalysis');
            expect(result).toContain('cnpjAnalysis');
        });
    });
});
