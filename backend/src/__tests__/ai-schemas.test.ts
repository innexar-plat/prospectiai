/**
 * Tests for AI Zod schemas.
 */
import { leadAnalysisCoreSchema, leadAnalysisSchema } from '@/lib/ai/schemas';

describe('leadAnalysisSchema', () => {
    const validAnalysis = {
        score: 75,
        scoreLabel: 'Hot',
        summary: 'Good lead with high potential',
        strengths: ['Strong brand', 'Good location'],
        weaknesses: ['No website'],
        painPoints: ['Customer complaints'],
        gaps: ['No online presence'],
        approach: 'Direct outreach',
        contactStrategy: 'WhatsApp first',
        firstContactMessage: 'Hello, I noticed your business...',
        suggestedWhatsAppMessage: 'Hi! Quick question...',
        reviewAnalysis: 'Mostly positive',
        reviewTrend: 'Growing',
        suggestedContactTime: 'Tuesday 10am',
        socialMedia: { instagram: 'Not found', facebook: 'Not found', linkedin: 'Not found' },
        fullReport: '# Detailed Report\n\nContent here',
        closeProbability: 65,
        estimatedDealValue: 5000,
        bestContactWindow: 'Tuesday 10am-12pm',
    };

    it('validates a correct lead analysis object', () => {
        const result = leadAnalysisSchema.safeParse(validAnalysis);
        expect(result.success).toBe(true);
    });

    it('validates a correct core lead analysis object without full report', () => {
        const { fullReport, ...core } = validAnalysis;
        const result = leadAnalysisCoreSchema.safeParse(core);
        expect(result.success).toBe(true);
    });

    it('accepts optional extended fields', () => {
        const withExtended = {
            ...validAnalysis,
            reclameAquiAnalysis: 'No complaints',
            jusBrasilAnalysis: 'Clean record',
            cnpjAnalysis: 'Active since 2015',
        };
        const result = leadAnalysisSchema.safeParse(withExtended);
        expect(result.success).toBe(true);
    });

    it('accepts missing optional fields', () => {
        const minimal = {
            score: 50,
            scoreLabel: 'Warm',
            summary: 'OK lead',
            strengths: [],
            weaknesses: [],
            painPoints: [],
            gaps: [],
            approach: '',
            contactStrategy: '',
            firstContactMessage: '',
            suggestedWhatsAppMessage: '',
            fullReport: '',
        };
        const result = leadAnalysisSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });

    it('rejects invalid score type', () => {
        const invalid = { ...validAnalysis, score: 'high' };
        const result = leadAnalysisSchema.safeParse(invalid);
        expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
        const result = leadAnalysisSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
