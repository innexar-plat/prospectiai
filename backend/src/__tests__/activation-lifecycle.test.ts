const mockUsers = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: { user: { findMany: (...a: unknown[]) => mockUsers(...a) } } }));
const mockFirst = jest.fn().mockResolvedValue(true);
const mockNudge = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/billing-emails', () => ({
    sendFirstSearchEmail: (...a: unknown[]) => mockFirst(...a),
    sendActivationNudgeEmail: (...a: unknown[]) => mockNudge(...a),
}));
jest.mock('@/lib/search-suggestions', () => ({ suggestSearchTerms: jest.fn().mockResolvedValue(['clínicas odontológicas', 'academias']) }));

import { runActivationEmails } from '@/lib/activation-lifecycle';

const NOW = new Date('2026-10-28T12:00:00Z');
const user = (id: string, searches: number) => ({
    id, email: `${id}@x.com`, name: 'Ana', market: 'BR', _count: { searchHistory: searches },
    workspaces: [{ workspace: { productService: 'software para clínicas', targetAudience: 'dentistas', city: 'Blumenau' } }],
});

beforeEach(() => jest.clearAllMocks());

describe('runActivationEmails', () => {
    it('D+1 users without searches get the first-search email with suggested niches', async () => {
        mockUsers.mockResolvedValueOnce([user('a', 0), user('b', 2)]).mockResolvedValueOnce([]);
        const r = await runActivationEmails(NOW, false);
        expect(r).toEqual({ firstSearch: 1, nudge: 0 });
        expect(mockFirst).toHaveBeenCalledWith('a', expect.objectContaining({ email: 'a@x.com' }), ['clínicas odontológicas', 'academias'], 'Blumenau');
        const where = mockUsers.mock.calls[0][0].where;
        expect(where).toEqual(expect.objectContaining({ notifyByEmail: true, onboardingCompletedAt: { not: null }, disabledAt: null }));
    });

    it('D+3 users with at most one search get the nudge; dry run sends nothing', async () => {
        mockUsers.mockResolvedValueOnce([]).mockResolvedValueOnce([user('c', 1), user('d', 5)]);
        const r = await runActivationEmails(NOW, true);
        expect(r).toEqual({ firstSearch: 0, nudge: 1 });
        expect(mockNudge).not.toHaveBeenCalled();
    });
});
