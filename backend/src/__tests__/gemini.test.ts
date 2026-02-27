import { analyzeLead, type BusinessData } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';
import { generateCompletionForRole } from '@/lib/ai';

jest.mock('@/lib/ai', () => ({
    generateCompletionForRole: jest.fn().mockResolvedValue({
        text: JSON.stringify({
            score: 8,
            scoreLabel: 'Hot',
            summary: 'Good lead',
            strengths: ['Growth'],
            weaknesses: ['Tech'],
            painPoints: [],
            gaps: [],
            approach: 'Direct',
            contactStrategy: 'Email',
            firstContactMessage: '',
            suggestedWhatsAppMessage: '',
            socialMedia: { instagram: 'mock' },
            fullReport: 'Report',
            reclameAquiAnalysis: 'No complaints found',
            jusBrasilAnalysis: 'No lawsuits found',
            cnpjAnalysis: 'Active company since 2010',
        }),
    }),
    resolveAiForRole: jest.fn().mockResolvedValue({ config: { provider: 'GEMINI', model: 'gemini-flash', apiKey: 'key' } }),
}));

jest.mock('@/lib/web-search/resolve', () => ({
    getWebContextForRole: jest.fn().mockResolvedValue(
        '## 📊 Contexto da Web (dados reais coletados)\n\n### 🔴 Reclame Aqui — Reputação do Consumidor\n- **No results** — [example.com](example.com)\n\n### ⚖️ JusBrasil — Processos Judiciais\n- **No results** — [example.com](example.com)\n'
    ),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(), upsert: jest.fn() },
        lead: { findUnique: jest.fn() },
        leadAnalysis: { create: jest.fn() }
    }
}));

describe('Gemini AI Lib', () => {
    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        prisma.user.findUnique.mockResolvedValue(null);
        prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
        prisma.leadAnalysis.create.mockResolvedValue({});
    });

    it('should generate analysis for a lead', async () => {
        const business: BusinessData = {
            placeId: 'p1',
            name: 'Coffee Shop'
        };

        const result = await analyzeLead(business, undefined, 'pt', 'user1');

        expect(result.analysis.score).toBe(8);
        expect(result.analysis.scoreLabel).toBe('Hot');
    });

    it('should include deep analysis instructions for BUSINESS plan', async () => {
        const business: BusinessData = {
            placeId: 'p2',
            name: 'Padaria Central',
            formattedAddress: 'Rua das Flores, 123, São Paulo',
        };

        const profile = {
            companyName: 'Innexar',
            productService: 'Marketing Digital',
            targetAudience: 'PMEs',
            mainBenefit: 'Resultados rápidos',
        };

        await analyzeLead(business, profile, 'pt', 'user1', true);

        // Verify the prompt sent to AI contains real data instructions (not "simule")
        const callArgs = jest.mocked(generateCompletionForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        expect(prompt).toContain('ANÁLISE PROFUNDA DE REPUTAÇÃO');
        expect(prompt).not.toContain('Simule uma busca');
        expect(prompt).toContain('dados REAIS');
        expect(prompt).toContain('reclameAquiAnalysis');
        expect(prompt).toContain('jusBrasilAnalysis');
        expect(prompt).toContain('cnpjAnalysis');
    });

    it('should NOT include deep analysis fields for FREE plan', async () => {
        const business: BusinessData = {
            placeId: 'p3',
            name: 'Loja Teste',
        };

        await analyzeLead(business, undefined, 'pt', 'user1', false);

        const callArgs = jest.mocked(generateCompletionForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        expect(prompt).not.toContain('reclameAquiAnalysis');
        expect(prompt).not.toContain('jusBrasilAnalysis');
        expect(prompt).not.toContain('cnpjAnalysis');
    });

    it('should include structured web context in prompt', async () => {
        const business: BusinessData = {
            placeId: 'p4',
            name: 'Restaurante Sol',
        };

        await analyzeLead(business, undefined, 'pt', 'user1', true);

        const callArgs = jest.mocked(generateCompletionForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        // Verify structured web context is present
        expect(prompt).toContain('Contexto da Web');
        expect(prompt).toContain('Reclame Aqui');
        expect(prompt).toContain('JusBrasil');
    });
});
