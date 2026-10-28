const mockQueryRaw = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }));

import { getRetentionReport } from '@/lib/admin-retention';

describe('getRetentionReport', () => {
    it('maps bigint aggregates into numbers', async () => {
        mockQueryRaw
            .mockResolvedValueOnce([{ signups: 7n, onboarded: 3n, searched: 3n, savedLead: 2n, contacted: 0n, paid: 0n, eligibleForReturn: 5n, returnedAfter7d: 0n }])
            .mockResolvedValueOnce([{ activeSearchers: 2n, contactsLogged: 1n, usersContacting: 1n, followUpsScheduled: 4n, followUpsOverdue: 0n }])
            .mockResolvedValueOnce([{ day: '2026-10-28', calls: 3n, avgInput: '30563', avgOutput: '8862' }]);

        const r = await getRetentionReport(90, new Date('2026-10-28T12:00:00Z'));

        expect(r.cohortDays).toBe(90);
        expect(r.funnel).toEqual({ signups: 7, onboarded: 3, searched: 3, savedLead: 2, contacted: 0, paid: 0, eligibleForReturn: 5, returnedAfter7d: 0 });
        expect(r.weekly.followUpsScheduled).toBe(4);
        expect(r.aiCost).toEqual([{ day: '2026-10-28', calls: 3, avgInput: 30563, avgOutput: 8862 }]);
    });

    it('returns zeros when queries come back empty', async () => {
        mockQueryRaw.mockResolvedValue([]);
        const r = await getRetentionReport(30);
        expect(r.funnel.signups).toBe(0);
        expect(r.aiCost).toEqual([]);
    });
});
