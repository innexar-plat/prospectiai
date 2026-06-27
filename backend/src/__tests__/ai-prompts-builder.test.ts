/**
 * Tests for AI prompt builder module.
 */
import {
    buildTaskDescription,
    buildCompanyContext,
    buildLeadAnalysisPrompt,
    buildLeadReportSectionPrompt,
    buildRfDataBlock,
    buildReviewSignalsText,
    buildOpeningHoursText,
    expandProductService,
    formatLeadNiche,
    extractLeadLocation,
    buildGapsRequirement,
    buildIndustryGuardrails,
    buildSellerServicesBlock,
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

    describe('expandProductService', () => {
        it('expands only on exact industry keyword match', () => {
            expect(expandProductService('imobiliaria', false)).toContain('Imobiliária');
            expect(expandProductService('CRM para barbearias', false)).toBe('CRM para barbearias');
            expect(expandProductService('software for barber shops', true)).toBe('software for barber shops');
        });

        it('uses English expansions when isEn is true', () => {
            expect(expandProductService('real estate', true)).toContain('Real estate');
        });
    });

    describe('formatLeadNiche', () => {
        it('formats snake_case niche codes', () => {
            expect(formatLeadNiche('barber_shop')).toBe('Barber Shop');
        });
    });

    describe('extractLeadLocation', () => {
        it('extracts city and state from address', () => {
            expect(extractLeadLocation('123 Main St, Miami, FL')).toBe('Miami, FL');
        });
    });

    describe('buildGapsRequirement', () => {
        it('references seller offering and forbids wrong industries', () => {
            const profile: UserBusinessProfile = {
                companyName: 'BarberPro',
                productService: 'Barbershop booking software',
                targetAudience: 'Barbershops',
                mainBenefit: 'More appointments',
            };
            const result = buildGapsRequirement(profile, true);
            expect(result).toContain('BarberPro');
            expect(result).toContain('Barbershop booking software');
            expect(result).not.toContain('imobiliária');
        });
    });

    describe('buildIndustryGuardrails', () => {
        it('forbids imobiliária when seller is not real estate', () => {
            const profile: UserBusinessProfile = {
                companyName: 'BarberPro',
                productService: 'Barbershop SaaS',
                targetAudience: 'Barbers',
                mainBenefit: 'Growth',
            };
            const result = buildIndustryGuardrails(profile, true);
            expect(result).toContain('NEVER mention real estate');
            expect(result).not.toContain('Se você é imobiliária');
        });
    });

    describe('buildSellerServicesBlock', () => {
        it('includes Minha Empresa seller services', () => {
            const profile: UserBusinessProfile = {
                companyName: 'BarberPro',
                productService: 'Booking software for barbers',
                targetAudience: 'US barbershops',
                mainBenefit: 'Fill chairs',
                city: 'Miami',
                state: 'FL',
            };
            const result = buildSellerServicesBlock(profile, true);
            expect(result).toContain('SELLER COMPANY PROFILE');
            expect(result).toContain('Booking software for barbers');
            expect(result).toContain('Miami, FL');
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

        it('includes enriched business fields when provided', () => {
            const profile: UserBusinessProfile = {
                companyName: 'Acme',
                legalName: 'Acme LTDA',
                tradeName: 'Acme Brasil',
                cnpj: '12345678000199',
                primaryCnaeCode: '6201501',
                primaryCnaeDescription: 'Desenvolvimento de software',
                companySize: 'ME',
                foundingDate: '2020-01-10',
                productService: 'Consultoria comercial',
                targetAudience: 'PMEs',
                mainBenefit: 'Acelerar vendas',
                city: 'Santos',
                state: 'SP',
                serviceModel: 'hibrido',
                averageTicket: 1500,
                operationRadiusKm: 80,
                knownCompetitors: 'Concorrente A, Concorrente B',
            };

            const result = buildCompanyContext(profile, false);

            expect(result).toContain('Razão social');
            expect(result).toContain('Acme LTDA');
            expect(result).toContain('Nome fantasia');
            expect(result).toContain('Acme Brasil');
            expect(result).toContain('CNPJ');
            expect(result).toContain('12345678000199');
            expect(result).toContain('CNAE principal');
            expect(result).toContain('6201501');
            expect(result).toContain('Santos, SP');
            expect(result).toContain('Ticket médio');
            expect(result).toContain('1500');
            expect(result).toContain('Concorrentes conhecidos');
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
            const sellerProfile: UserBusinessProfile = {
                companyName: 'BarberPro',
                productService: 'Barbershop booking software',
                targetAudience: 'Barbershops',
                mainBenefit: 'More bookings',
            };
            const result = buildLeadAnalysisPrompt({
                business: { placeId: 'p1', name: 'Coffee Shop', rating: 4.5, primaryType: 'cafe' } as BusinessData,
                isEn: true,
                companyContext: 'We sell marketing services',
                taskDescription: 'You are a lead analyst',
                sellerProfile,
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
            expect(result).not.toContain('"fullReport"');
            expect(result).toContain('messageVariants');
            expect(result).toContain('quickActions');
            expect(result).toContain('keyMetrics');
            expect(result).not.toContain('Se você é imobiliária');
        });

        it('includes lead niche and location for barber_shop leads', () => {
            const sellerProfile: UserBusinessProfile = {
                companyName: 'BarberPro',
                productService: 'Barbershop management software',
                targetAudience: 'US barbershops',
                mainBenefit: 'More clients',
            };
            const result = buildLeadAnalysisPrompt({
                business: {
                    placeId: 'p-barber',
                    name: 'Classic Cuts',
                    primaryType: 'barber_shop',
                    rating: 4.8,
                } as BusinessData,
                isEn: true,
                companyContext: buildCompanyContext(sellerProfile, true),
                taskDescription: buildTaskDescription(true),
                sellerProfile,
                address: '500 Ocean Dr, Miami Beach, FL',
                phone: '+13055550100',
                website: '',
                reviewCount: 120,
                reviewsText: 'Great fades',
                reviewSignalsText: 'No negative signals',
                openingHoursText: 'Open now',
                webContext: '',
                isBusinessPlan: false,
                conversionContext: '',
                rfDataBlock: '',
                websiteScrapingBlock: '',
            });

            expect(result).toContain('LEAD NICHE & LOCATION');
            expect(result).toContain('barber_shop');
            expect(result).toContain('Barber Shop');
            expect(result).toContain('Miami Beach, FL');
            expect(result).toContain('Barbershop management software');
            expect(result).not.toContain('Se você é imobiliária');
            expect(result).not.toContain('busque necessidades de espaço/imóvel');
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

        it('builds a segmented report section prompt', () => {
            const result = buildLeadReportSectionPrompt({
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
                sectionTitle: 'Executive Summary',
                sectionInstruction: 'Summarize the opportunity.',
                coreAnalysisJson: '{"score":90}',
            });

            expect(result).toContain('CORE ANALYSIS JSON');
            expect(result).toContain('Executive Summary');
            expect(result).toContain('Write only the Markdown body');
        });
    });
});
