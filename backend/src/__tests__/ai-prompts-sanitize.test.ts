import {
    sanitizeAnalysisText,
    sanitizeLeadAnalysisCore,
    sellerMatchesIndustry,
    getOffTopicIndustryPatterns,
} from '@/lib/ai/prompts/sanitize';
import type { LeadAnalysisCore, UserBusinessProfile } from '@/lib/ai/prompts/analyze-types';

const barberSeller: UserBusinessProfile = {
    companyName: 'BarberPro',
    productService: 'Barbershop booking and CRM software',
    targetAudience: 'US barbershops',
    mainBenefit: 'More appointments',
};

describe('AI prompt sanitize', () => {
    it('detects real estate seller profile', () => {
        expect(sellerMatchesIndustry({
            companyName: 'Nova Luz',
            productService: 'Imobiliária residencial',
            targetAudience: 'Compradores',
            mainBenefit: 'Agilidade',
        }, 'real_estate')).toBe(true);
        expect(sellerMatchesIndustry(barberSeller, 'real_estate')).toBe(false);
    });

    it('returns real-estate patterns when seller is not real estate', () => {
        const patterns = getOffTopicIndustryPatterns(barberSeller);
        expect(patterns.some((p) => p.test('imobiliária nova luz'))).toBe(true);
    });

    it('replaces off-topic real estate terms in text', () => {
        const input = 'Nossa solução imobiliária nova luz pode ajudar esta barbearia.';
        const result = sanitizeAnalysisText(input, barberSeller);
        expect(result.toLowerCase()).not.toContain('imobiliária');
        expect(result).toContain('Barbershop booking and CRM software');
    });

    it('preserves real estate terms when seller is real estate', () => {
        const seller: UserBusinessProfile = {
            companyName: 'Nova Luz',
            productService: 'Imobiliária comercial',
            targetAudience: 'Empresas',
            mainBenefit: 'Localização',
        };
        const input = 'A imobiliária Nova Luz tem o espaço ideal.';
        expect(sanitizeAnalysisText(input, seller)).toBe(input);
    });

    it('sanitizes structured analysis fields', () => {
        const analysis: LeadAnalysisCore = {
            score: 80,
            scoreLabel: 'Hot',
            summary: 'A imobiliária pode oferecer uma solução.',
            strengths: ['Boa reputação'],
            weaknesses: ['Sem parceiro imobiliário'],
            painPoints: [],
            gaps: [],
            approach: 'Pitch imobiliária nova luz',
            contactStrategy: 'WhatsApp',
            firstContactMessage: 'Somos uma imobiliária nova luz.',
            suggestedWhatsAppMessage: 'Olá, somos imobiliária.',
            messageVariants: {
                whatsapp: { short: 'imobiliária nova luz', medium: 'solução imobiliária' },
                email: { short: 'imobiliária', medium: 'corretor de imóveis' },
            },
        };

        const sanitized = sanitizeLeadAnalysisCore(analysis, barberSeller);
        expect(sanitized.summary.toLowerCase()).not.toContain('imobiliária');
        expect(sanitized.firstContactMessage.toLowerCase()).not.toContain('imobiliária');
        expect(sanitized.messageVariants?.whatsapp?.short?.toLowerCase()).not.toContain('imobiliária');
    });
});
