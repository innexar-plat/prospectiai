const mockFindFirst = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue({});
const mockEventCount = jest.fn();
const mockWorkspace = jest.fn();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        leadAnalysis: { findFirst: (...a: unknown[]) => mockFindFirst(...a), update: (...a: unknown[]) => mockUpdate(...a) },
        leadEvent: { count: (...a: unknown[]) => mockEventCount(...a) },
        workspace: { findUnique: (...a: unknown[]) => mockWorkspace(...a) },
    },
}));
const mockCompletion = jest.fn();
jest.mock('@/lib/ai/resolve', () => ({ generateCompletionForRole: (...a: unknown[]) => mockCompletion(...a) }));
const mockUsage = jest.fn();
jest.mock('@/lib/usage', () => ({ recordUsageEvent: (...a: unknown[]) => mockUsage(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { angleForTouch, buildFollowUpPrompt, getFollowUpMessage } from '@/lib/follow-up-message';

const analysis = (extras: unknown = null) => ({
    id: 'a1', leadId: 'l1', workspaceId: 'w1', extras,
    suggestedWhatsAppMessage: 'Oi! Vi que vocês não têm site.', firstContactMessage: null,
    lead: { name: 'Padaria Sol', types: ['bakery'] },
});

beforeEach(() => jest.clearAllMocks());

describe('angleForTouch', () => {
    it('uses bump, proof, then breakup', () => {
        expect(angleForTouch(2, false)).toMatch(/Retomada/);
        expect(angleForTouch(3, false)).toMatch(/Prova/);
        expect(angleForTouch(4, false)).toMatch(/Último contato/);
        expect(angleForTouch(9, true)).toMatch(/last touch/);
    });
});

describe('buildFollowUpPrompt', () => {
    it('includes the previous message and the seller offer', () => {
        const p = buildFollowUpPrompt({ en: false, touch: 2, leadName: 'Padaria Sol', niche: 'bakery', previousMessage: 'Oi!', seller: { companyName: 'Web+', productService: 'sites' } });
        expect(p).toContain('nº 2');
        expect(p).toContain('Mensagem anterior enviada: Oi!');
        expect(p).toContain('Web+ — vende: sites');
    });
});

describe('getFollowUpMessage', () => {
    it('generates the next touch once and caches it in extras', async () => {
        mockFindFirst.mockResolvedValueOnce(analysis({ quickActions: [] }));
        mockEventCount.mockResolvedValueOnce(1);
        mockWorkspace.mockResolvedValueOnce({ companyName: 'Web+', productService: 'sites', mainBenefit: null });
        mockCompletion.mockResolvedValueOnce({ text: '"Oi de novo! Posso te mostrar em 10 min?"', usage: { inputTokens: 300, outputTokens: 40 }, provider: 'DEEPSEEK', model: 'x' });

        const r = await getFollowUpMessage('a1', { userId: 'u1', workspaceId: 'w1' }, false);

        expect(r).toEqual({ touch: 2, message: 'Oi de novo! Posso te mostrar em 10 min?', cached: false });
        expect(mockUpdate.mock.calls[0][0].data.extras).toEqual({ quickActions: [], followUpMessages: { 2: 'Oi de novo! Posso te mostrar em 10 min?' } });
        expect(mockUsage).toHaveBeenCalledWith(expect.objectContaining({ type: 'AI_TOKENS', workspaceId: 'w1' }));
    });

    it('returns the cached message without calling the AI', async () => {
        mockFindFirst.mockResolvedValueOnce(analysis({ followUpMessages: { 3: 'cached!' } }));
        mockEventCount.mockResolvedValueOnce(2);
        const r = await getFollowUpMessage('a1', { userId: 'u1', workspaceId: 'w1' }, false);
        expect(r).toEqual({ touch: 3, message: 'cached!', cached: true });
        expect(mockCompletion).not.toHaveBeenCalled();
    });

    it('returns null for leads outside the workspace', async () => {
        mockFindFirst.mockResolvedValueOnce(null);
        expect(await getFollowUpMessage('zz', { userId: 'u1', workspaceId: 'w1' }, false)).toBeNull();
    });
});
