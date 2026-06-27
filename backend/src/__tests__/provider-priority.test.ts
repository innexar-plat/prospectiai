import { compareProviderPriority, getProviderTier } from '@/lib/ai/provider-priority';

describe('provider-priority', () => {
    it('ranks CLOUDFLARE before GEMINI before OPENROUTER', () => {
        expect(getProviderTier('CLOUDFLARE')).toBeLessThan(getProviderTier('GEMINI'));
        expect(getProviderTier('GEMINI')).toBeLessThan(getProviderTier('OPENROUTER'));
    });

    it('sorts configs by provider tier then updatedAt', () => {
        const sorted = [
            { provider: 'GEMINI', updatedAt: new Date('2026-06-01') },
            { provider: 'OPENROUTER', updatedAt: new Date('2026-01-01') },
            { provider: 'CLOUDFLARE', updatedAt: new Date('2026-03-01') },
        ].sort(compareProviderPriority);

        expect(sorted.map((c) => c.provider)).toEqual(['CLOUDFLARE', 'GEMINI', 'OPENROUTER']);
    });
});
