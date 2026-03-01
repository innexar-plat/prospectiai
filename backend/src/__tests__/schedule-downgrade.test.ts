import {
    performScheduleDowngrade,
    ScheduleDowngradeError,
} from '@/lib/schedule-downgrade';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspace: { update: jest.fn() },
    },
}));

jest.mock('@/lib/stripe', () => ({
    stripe: {
        subscriptions: {
            retrieve: jest.fn(),
        },
        subscriptionSchedules: {
            create: jest.fn(),
            update: jest.fn(),
        },
    },
}));

describe('schedule-downgrade', () => {
    beforeEach(() => jest.clearAllMocks());

    it('throws 400 for invalid plan', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: null,
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        await expect(
            performScheduleDowngrade(workspace as never, 'INVALID' as never)
        ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 for target plan FREE', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: null,
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        await expect(
            performScheduleDowngrade(workspace as never, 'FREE')
        ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when current plan is FREE', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'FREE',
            subscriptionId: null,
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        await expect(
            performScheduleDowngrade(workspace as never, 'BASIC')
        ).rejects.toMatchObject({ status: 400 });
    });

    it('throws 400 when not a downgrade (e.g. upgrade)', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'BASIC',
            subscriptionId: null,
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        await expect(
            performScheduleDowngrade(workspace as never, 'PRO')
        ).rejects.toMatchObject({ status: 400 });
    });

    it('updates workspace and returns result when no Stripe subscription', async () => {
        const periodEnd = new Date(Date.now() + 86400000);
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: null,
            currentPeriodEnd: periodEnd,
        };
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});

        const result = await performScheduleDowngrade(workspace as never, 'BASIC');

        expect(result.pendingPlanId).toBe('BASIC');
        expect(result.message).toMatch(/Starter|BASIC/);
        expect(prisma.workspace.update).toHaveBeenCalledWith({
            where: { id: 'ws1' },
            data: expect.objectContaining({
                pendingPlanId: 'BASIC',
            }),
        });
        expect(result.pendingPlanEffectiveAt).toBeDefined();
    });

    it('uses currentPeriodEnd when in the future for effectiveAt', async () => {
        const periodEnd = new Date(Date.now() + 10 * 86400000);
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: null,
            currentPeriodEnd: periodEnd,
        };
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});

        await performScheduleDowngrade(workspace as never, 'BASIC');

        const call = (prisma.workspace.update as jest.Mock).mock.calls[0][0];
        expect(call.data.pendingPlanEffectiveAt).toEqual(periodEnd);
    });
});
