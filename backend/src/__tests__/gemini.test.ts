import { analyzeLead, type BusinessData } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';
import { generateCompletionForRole, generateObjectForRole } from '@/lib/ai';

jest.mock('@/lib/ai', () => ({
    generateObjectForRole: jest.fn().mockResolvedValue({
        text: '{}',
        object: {
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
            reclameAquiAnalysis: 'No complaints found',
            jusBrasilAnalysis: 'No lawsuits found',
            cnpjAnalysis: 'Active company since 2010',
        },
        usage: { inputTokens: 20, outputTokens: 40 },
        provider: 'GEMINI',
        model: 'gemini-structured',
    }),
    generateCompletionForRole: jest.fn().mockResolvedValue({
        text: 'Detailed markdown section body.',
        usage: { inputTokens: 10, outputTokens: 30 },
    }),
    resolveAiForRole: jest.fn().mockResolvedValue({ config: { provider: 'GEMINI', model: 'gemini-flash', apiKey: 'key' }, model: { modelId: 'gemini-mock' } }),
}));

jest.mock('@/lib/web-search/resolve', () => ({
    getWebContextForRole: jest.fn().mockResolvedValue(
        '## 📊 Contexto da Web (dados reais coletados)\n\n### 🔴 Reclame Aqui — Reputação do Consumidor\n- **No results** — [example.com](example.com)\n\n### ⚖️ JusBrasil — Processos Judiciais\n- **No results** — [example.com](example.com)\n'
    ),
}));

jest.mock('@/lib/notification-service', () => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/lead-intelligence', () => ({
    getConversionStats: jest.fn().mockResolvedValue(null),
    buildConversionContext: jest.fn().mockReturnValue('Conversion data: Not available.'),
    recordLeadEvent: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: jest.fn(), upsert: jest.fn() },
        lead: { findUnique: jest.fn() },
        leadAnalysis: { create: jest.fn() },
        pipelineBrief: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    }
}));

const prismaMock = prisma as unknown as {
    user: { findUnique: jest.Mock; upsert: jest.Mock };
    lead: { findUnique: jest.Mock };
    leadAnalysis: { create: jest.Mock };
    pipelineBrief: { deleteMany: jest.Mock };
};

describe('Gemini AI Lib', () => {
    beforeEach(() => {
        process.env.GEMINI_API_KEY = 'test-key';
        delete process.env.ANALYZE_AI_MAX_OUTPUT_TOKENS;
        delete process.env.ANALYZE_AI_REPORT_SECTION_MAX_OUTPUT_TOKENS;
        prismaMock.user.findUnique.mockResolvedValue(null);
        prismaMock.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
        prismaMock.leadAnalysis.create.mockResolvedValue({});
        jest.mocked(generateObjectForRole).mockClear();
        jest.mocked(generateCompletionForRole).mockClear();
        jest.mocked(generateObjectForRole).mockResolvedValue({
            text: '{}',
            object: {
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
                reclameAquiAnalysis: 'No complaints found',
                jusBrasilAnalysis: 'No lawsuits found',
                cnpjAnalysis: 'Active company since 2010',
            },
            usage: { inputTokens: 20, outputTokens: 40 },
            provider: 'GEMINI',
            model: 'gemini-structured',
        });
        jest.mocked(generateCompletionForRole).mockResolvedValue({
            text: 'Detailed markdown section body.',
            usage: { inputTokens: 10, outputTokens: 30 },
        });
    });

    it('should generate analysis for a lead', async () => {
        const business: BusinessData = {
            placeId: 'p1',
            name: 'Coffee Shop'
        };

        const result = await analyzeLead(business, undefined, 'pt', 'user1');

        expect(result.analysis.score).toBe(8);
        expect(result.analysis.scoreLabel).toBe('Hot');
        expect(result.analysis.fullReport).toContain('## Resumo Executivo');
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
        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
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

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
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

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        // Verify structured web context is present
        expect(prompt).toContain('Contexto da Web');
        expect(prompt).toContain('Reclame Aqui');
        expect(prompt).toContain('JusBrasil');
    });

    it('falls back to parsed JSON when structured generation fails', async () => {
        const mockResponse = 'Here is the analysis:\n```json\n{"score": 90, "scoreLabel": "Hot", "summary": "Strong", "strengths": [], "weaknesses": [], "painPoints": [], "gaps": [], "approach": "Direct", "contactStrategy": "Phone", "firstContactMessage": "Hi", "suggestedWhatsAppMessage": "Oi"}\n```\nHope it helps!';
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('structured failed'));
        jest.mocked(generateCompletionForRole)
            .mockResolvedValueOnce({ text: mockResponse, usage: { inputTokens: 10, outputTokens: 20 } })
            .mockResolvedValue({ text: 'Detailed markdown section body.', usage: { inputTokens: 5, outputTokens: 15 } });

        const business: BusinessData = { placeId: 'p-md', name: 'MD Store' };
        const result = await analyzeLead(business, undefined, 'en');

        expect(result.analysis.score).toBe(90);
        expect(result.analysis.scoreLabel).toBe('Hot');
    });

    it('should use English labels when locale is "en"', async () => {
        const business: BusinessData = { placeId: 'p-en', name: 'EN Store' };
        await analyzeLead(business, undefined, 'en');

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        expect(prompt).toContain('LEAD DATA:');
        expect(prompt).toContain('Business Name: EN Store');
    });

    it('should use Portuguese labels when locale is "pt"', async () => {
        const business: BusinessData = { placeId: 'p-pt', name: 'Loja PT' };
        await analyzeLead(business, undefined, 'pt');

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const lastCall = callArgs[callArgs.length - 1];
        const prompt = lastCall[1].prompt as string;

        expect(prompt).toContain('DADOS DO LEAD:');
        expect(prompt).toContain('Nome do Negócio: Loja PT');
    });

    it('when AI throws returns fallback analysis with translated error message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('429 quota exceeded'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('429 quota exceeded'));
        const business: BusinessData = { placeId: 'p-err', name: 'Err Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.score).toBe(0);
        expect(result.analysis.scoreLabel).toBe('Indisponível');
        expect(result.analysis.summary).toContain('Limite de uso');
    });

    it('when AI throws 401 returns fallback with API key message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('401 invalid api key'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('401 invalid api key'));
        const business: BusinessData = { placeId: 'p-401', name: 'Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.summary).toContain('Chave da API inválida');
    });

    it('when AI throws no ai config returns fallback with config message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('no ai config for role'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('no ai config for role'));
        const business: BusinessData = { placeId: 'p-noconf', name: 'Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.summary).toContain('IA não configurada');
    });

    it('when AI throws 403 returns fallback with restriction message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('403 restriction'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('403 restriction'));
        const business: BusinessData = { placeId: 'p-403', name: 'Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.summary).toContain('restrição');
    });

    it('when AI throws 500 returns fallback with unavailable message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('500 unavailable'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('500 unavailable'));
        const business: BusinessData = { placeId: 'p-500', name: 'Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.summary).toContain('indisponível');
    });

    it('when AI throws 404 model returns fallback with model message', async () => {
        jest.mocked(generateObjectForRole).mockRejectedValueOnce(new Error('404 no longer available'));
        jest.mocked(generateCompletionForRole).mockRejectedValueOnce(new Error('404 no longer available'));
        const business: BusinessData = { placeId: 'p-404', name: 'Lead' };
        const result = await analyzeLead(business, undefined, 'pt');
        expect(result.analysis.summary).toContain('não está mais disponível');
    });

    it('when userProfile not provided but userId provided loads profile from DB', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 'user-1',
            companyName: 'DB Company',
            productService: 'DB Service',
            targetAudience: 'DB Audience',
            mainBenefit: 'DB Benefit',
            workspaces: [],
        } as never);
        const business: BusinessData = { placeId: 'p-db', name: 'Lead' };
        await analyzeLead(business, undefined, 'pt', 'user-1');
        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const prompt = callArgs[callArgs.length - 1][1].prompt as string;
        expect(prompt).toContain('DB Company');
        expect(prompt).toContain('DB Service');
    });

    it('loads enriched workspace profile fields into the prompt when available', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            companyName: 'Fallback Company',
            productService: 'Fallback Service',
            targetAudience: 'Fallback Audience',
            mainBenefit: 'Fallback Benefit',
            workspaces: [
                {
                    workspace: {
                        companyName: 'Workspace Company',
                        legalName: 'Workspace LTDA',
                        tradeName: 'Workspace Trade',
                        cnpj: '12345678000199',
                        primaryCnaeCode: '6201501',
                        primaryCnaeDescription: 'Desenvolvimento de software',
                        companySize: 'ME',
                        foundingDate: '2020-01-10',
                        productService: 'Consultoria comercial',
                        targetAudience: 'PMEs',
                        mainBenefit: 'Mais eficiência comercial',
                        city: 'Santos',
                        state: 'SP',
                        serviceModel: 'hibrido',
                        averageTicket: 1200,
                        operationRadiusKm: 50,
                        knownCompetitors: 'Concorrente A',
                    },
                },
            ],
        } as never);

        await analyzeLead({ placeId: 'p-enriched', name: 'Lead Enriquecido' }, undefined, 'pt', 'user-1');

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const prompt = callArgs[callArgs.length - 1][1].prompt as string;

        expect(prompt).toContain('Workspace Company');
        expect(prompt).toContain('Workspace LTDA');
        expect(prompt).toContain('Workspace Trade');
        expect(prompt).toContain('12345678000199');
        expect(prompt).toContain('6201501');
        expect(prompt).toContain('Santos, SP');
        expect(prompt).toContain('Ticket médio');
        expect(prompt).toContain('Concorrente A');
    });

    it('when business has website prompt includes website note', async () => {
        const business: BusinessData = {
            placeId: 'p-web',
            name: 'With Web',
            websiteUri: 'https://example.com',
        };
        await analyzeLead(business, undefined, 'pt');
        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const prompt = callArgs[callArgs.length - 1][1].prompt as string;
        expect(prompt).toContain('POSSUI website');
    });

    it('uses ANALYZE_AI_MAX_OUTPUT_TOKENS when configured', async () => {
        process.env.ANALYZE_AI_MAX_OUTPUT_TOKENS = '256';
        const business: BusinessData = { placeId: 'p-tokens', name: 'Low Cost Lead' };
        await analyzeLead(business, undefined, 'pt');

        const callArgs = jest.mocked(generateObjectForRole).mock.calls;
        const options = callArgs[callArgs.length - 1][1];
        expect(options.maxOutputTokens).toBe(256);
    });

    it('uses ANALYZE_AI_REPORT_SECTION_MAX_OUTPUT_TOKENS when configured', async () => {
        process.env.ANALYZE_AI_REPORT_SECTION_MAX_OUTPUT_TOKENS = '300';
        const business: BusinessData = { placeId: 'p-sections', name: 'Segmented Lead' };
        await analyzeLead(business, undefined, 'pt');

        const reportCalls = jest.mocked(generateCompletionForRole).mock.calls;
        expect(reportCalls[0][1].maxOutputTokens).toBe(300);
    });
});
