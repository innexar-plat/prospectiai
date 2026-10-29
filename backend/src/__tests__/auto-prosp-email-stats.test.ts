const m = {
    config: jest.fn(), pool: jest.fn(), evCount: jest.fn(), groupBy: jest.fn(), evFind: jest.fn(), raw: jest.fn(),
};
jest.mock('@/lib/prisma', () => ({
    prisma: {
        autoProspeccaoConfig: { findUnique: (...a: unknown[]) => m.config(...a) },
        autoProspSenderPool: { count: (...a: unknown[]) => m.pool(...a) },
        prospectedLeadEmailEvent: { count: (...a: unknown[]) => m.evCount(...a), findMany: (...a: unknown[]) => m.evFind(...a) },
        prospectedLead: { groupBy: (...a: unknown[]) => m.groupBy(...a) },
        $queryRaw: (...a: unknown[]) => m.raw(...a),
    },
}));

import { getAutoProspEmailStats } from '@/lib/auto-prosp-email-stats';

describe('getAutoProspEmailStats', () => {
    it('reports warm-up budget, open rate, pipeline and recent e-mails', async () => {
        const now = new Date('2026-11-03T13:00:00Z');
        m.config.mockResolvedValue({ isActive: true, emailAutoSend: true, useSystemSender: true, systemSenderStartedAt: new Date('2026-11-02T13:00:00Z'), maxEmailsPerDay: 120, replyToEmail: 'v@p.com', senderName: 'V' });
        m.pool.mockResolvedValue(0);
        // sentToday, sent7d, sentTotal, opened7d, openedTotal
        m.evCount.mockResolvedValueOnce(4).mockResolvedValueOnce(20).mockResolvedValueOnce(201).mockResolvedValueOnce(5).mockResolvedValueOnce(5);
        m.groupBy.mockResolvedValue([{ status: 'EMAILING', _count: { _all: 12 } }, { status: 'OPTED_OUT', _count: { _all: 2 } }]);
        m.evFind.mockResolvedValue([{ id: 'e1', step: 1, subject: 'Oi', sentAt: now, openedAt: null, lead: { razaoSocial: 'ACME LTDA', nomeFantasia: 'Acme', email: 'a@acme.com', municipio: 'SAO PAULO', uf: 'SP', status: 'EMAILING', score: 80 } }]);
        m.raw.mockResolvedValue([{ day: '2026-11-03', sent: 4n, opened: 1n }]);

        const r = await getAutoProspEmailStats('w1', now);

        expect(r.sender).toEqual(expect.objectContaining({ mode: 'system', active: true, dailyCap: 15, sentToday: 4, remainingToday: 11, businessHoursNow: true }));
        expect(r.totals).toEqual(expect.objectContaining({ sent7d: 20, openRate7d: 25, optedOut: 2, bounced: 0 }));
        expect(r.daily).toEqual([{ day: '2026-11-03', sent: 4, opened: 1 }]);
        expect(r.recent[0]).toEqual(expect.objectContaining({ company: 'Acme', city: 'SAO PAULO / SP' }));
    });
});
