const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockUsers = jest.fn();
jest.mock('@/lib/prisma', () => ({
    prisma: {
        leadAnalysis: { findMany: (...a: unknown[]) => mockFindMany(...a), count: (...a: unknown[]) => mockCount(...a) },
        user: { findMany: (...a: unknown[]) => mockUsers(...a) },
    },
}));
const mockReminder = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/billing-emails', () => ({ sendFollowUpReminderEmail: (...a: unknown[]) => mockReminder(...a) }));
const mockNotify = jest.fn().mockResolvedValue({ id: 'n1' });
jest.mock('@/lib/notification-service', () => ({ createNotification: (...a: unknown[]) => mockNotify(...a) }));
const mockLock = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/redis', () => ({ acquireRedisLock: (...a: unknown[]) => mockLock(...a) }));

import { followUpForStatusChange, getTodayAgenda, localDayBounds, runFollowUpReminders } from '@/lib/sales-routine';

// 2026-10-28 12:00 UTC = 09:00 in Brasília
const NOW = new Date('2026-10-28T12:00:00Z');

const row = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    score: 50,
    closeProbability: 30,
    bestContactWindow: null,
    suggestedWhatsAppMessage: 'Olá!',
    firstContactMessage: null,
    status: 'NEW',
    nextFollowUpAt: null,
    contactedAt: null,
    lead: { placeId: `p-${id}`, name: `Lead ${id}`, phone: '11 9999-0000', recommendedPhone: null },
    ...extra,
});

beforeEach(() => jest.clearAllMocks());

describe('localDayBounds', () => {
    it('uses the Brasília day by default', () => {
        const { start, end } = localDayBounds(new Date('2026-10-29T01:00:00Z'));
        // 01:00 UTC on the 29th is still the 28th in Brasília
        expect(start.toISOString()).toBe('2026-10-28T03:00:00.000Z');
        expect(end.toISOString()).toBe('2026-10-29T03:00:00.000Z');
    });

    it('honours the browser offset', () => {
        expect(localDayBounds(NOW, 0).start.toISOString()).toBe('2026-10-28T00:00:00.000Z');
    });
});

describe('followUpForStatusChange', () => {
    it('schedules 3 days after the first contact and clears on close', () => {
        expect(followUpForStatusChange('CONTACTED', 'NEW', undefined, NOW)?.toISOString()).toBe('2026-10-31T12:00:00.000Z');
        expect(followUpForStatusChange('CONVERTED', 'CONTACTED', undefined, NOW)).toBeNull();
        expect(followUpForStatusChange('LOST', 'NEW', undefined, NOW)).toBeNull();
        expect(followUpForStatusChange(undefined, 'NEW', undefined, NOW)).toBeUndefined();
    });

    it('an explicit date always wins', () => {
        expect(followUpForStatusChange('CONTACTED', 'NEW', '2026-11-05T12:00:00.000Z', NOW)?.toISOString()).toBe('2026-11-05T12:00:00.000Z');
        expect(followUpForStatusChange(undefined, 'CONTACTED', null, NOW)).toBeNull();
    });
});

describe('getTodayAgenda', () => {
    it('lists overdue and due follow-ups first, then the best fresh leads', async () => {
        mockFindMany
            .mockResolvedValueOnce([
                row('a', { status: 'CONTACTED', nextFollowUpAt: new Date('2026-10-26T12:00:00Z') }),
                row('b', { status: 'CONTACTED', nextFollowUpAt: new Date('2026-10-28T15:00:00Z') }),
            ])
            .mockResolvedValueOnce([row('c', { score: 82 }), row('d', { score: null })]);
        mockCount.mockResolvedValueOnce(12).mockResolvedValueOnce(1).mockResolvedValueOnce(4);

        const agenda = await getTodayAgenda({ userId: 'u1', workspaceId: 'w1' }, NOW);

        expect(agenda.items.map((i) => [i.analysisId, i.reason])).toEqual([
            ['a', 'overdue'], ['b', 'due_today'], ['c', 'hot_new'], ['d', 'new'],
        ]);
        expect(agenda.items[0]!.overdueDays).toBe(2);
        expect(agenda.items[0]!.whatsappMessage).toBe('Olá!');
        expect(agenda.stats).toEqual({ dueCount: 2, contactedToday: 1, contactedThisWeek: 4, activeLeads: 12 });
        expect(mockFindMany.mock.calls[0][0].where).toEqual(expect.objectContaining({ workspaceId: 'w1' }));
    });
});

describe('runFollowUpReminders', () => {
    it('e-mails only users with a follow-up due today, counting overdue ones in', async () => {
        mockFindMany.mockResolvedValueOnce([
            { userId: 'u1', nextFollowUpAt: new Date('2026-10-20T12:00:00Z'), lead: { name: 'Old' } },
            { userId: 'u1', nextFollowUpAt: new Date('2026-10-28T13:00:00Z'), lead: { name: 'Today' } },
            { userId: 'u2', nextFollowUpAt: new Date('2026-10-21T12:00:00Z'), lead: { name: 'Only overdue' } },
        ]);
        mockUsers.mockResolvedValueOnce([
            { id: 'u1', email: 'u1@x.com', name: 'Ana', market: 'BR', notifyByEmail: true },
        ]);

        const r = await runFollowUpReminders(NOW, false);

        expect(mockUsers.mock.calls[0][0].where.id).toEqual({ in: ['u1'] });
        expect(r).toEqual({ sent: 1, pushed: 1, candidates: 1 });
        expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', channel: 'follow_up_due', link: '/dashboard#hoje', title: '2 follow-ups para hoje' }));
        expect(mockReminder).toHaveBeenCalledWith('u1', expect.objectContaining({ email: 'u1@x.com' }), {
            total: 2, overdue: 1, names: ['Old', 'Today'], day: '2026-10-28',
        });
    });

    it('dry run sends nothing', async () => {
        mockFindMany.mockResolvedValueOnce([{ userId: 'u1', nextFollowUpAt: new Date('2026-10-28T13:00:00Z'), lead: { name: 'X' } }]);
        mockUsers.mockResolvedValueOnce([{ id: 'u1', email: 'u1@x.com', name: null, market: 'BR' }]);
        expect(await runFollowUpReminders(NOW, true)).toEqual({ sent: 0, pushed: 0, candidates: 1 });
        expect(mockReminder).not.toHaveBeenCalled();
    });
});

describe('runFollowUpReminders push-only users', () => {
    it('pushes to users who opted out of e-mail, without e-mailing them', async () => {
        mockFindMany.mockResolvedValueOnce([{ userId: 'u3', nextFollowUpAt: new Date('2026-10-28T13:00:00Z'), lead: { name: 'X' } }]);
        mockUsers.mockResolvedValueOnce([{ id: 'u3', email: 'u3@x.com', name: null, market: 'BR', notifyByEmail: false }]);
        expect(await runFollowUpReminders(NOW, false)).toEqual({ sent: 0, pushed: 1, candidates: 1 });
        expect(mockReminder).not.toHaveBeenCalled();
    });
});

