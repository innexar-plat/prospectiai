import {
    performScheduleDowngrade,
    ScheduleDowngradeError,
} from '@/lib/schedule-downgrade';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

jest.mock('@/lib/prisma', () => ({
    prisma: {
        workspace: { update: jest.fn() },
    },
}));

jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

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

    it('ScheduleDowngradeError.error getter returns message', () => {
        const err = new ScheduleDowngradeError(400, 'Invalid plan');
        expect(err.error).toBe('Invalid plan');
        expect(err.status).toBe(400);
    });

    it('with Stripe subscriptionId calls Stripe and updates workspace', async () => {
        const periodEnd = new Date(Date.now() + 86400000);
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: 'sub_123',
            currentPeriodEnd: periodEnd,
        };
        (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
            current_period_end: Math.floor(periodEnd.getTime() / 1000),
            current_period_start: Math.floor((Date.now() - 86400000) / 1000),
            items: { data: [{ price: { id: 'price_abc' } }] },
        });
        (stripe.subscriptionSchedules.create as jest.Mock).mockResolvedValue({ id: 'sched_1' });
        (stripe.subscriptionSchedules.update as jest.Mock).mockResolvedValue({});
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});

        const result = await performScheduleDowngrade(workspace as never, 'BASIC');

        expect(result.pendingPlanId).toBe('BASIC');
        expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123', { expand: ['items.data.price'] });
        expect(stripe.subscriptionSchedules.create).toHaveBeenCalledWith({ from_subscription: 'sub_123' });
        expect(stripe.subscriptionSchedules.update).toHaveBeenCalled();
        expect(prisma.workspace.update).toHaveBeenCalled();
    });

    it('when Stripe subscription has no price item throws 400', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: 'sub_123',
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        (stripe.subscriptions.retrieve as jest.Mock).mockResolvedValue({
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
            current_period_start: Math.floor(Date.now() / 1000) - 86400,
            items: { data: [{}] },
        });

        await expect(performScheduleDowngrade(workspace as never, 'BASIC')).rejects.toMatchObject({
            status: 400,
            message: 'Subscription has no price item',
        });
    });

    it('when Stripe API throws non-ScheduleDowngradeError throws 502', async () => {
        const workspace = {
            id: 'ws1',
            plan: 'PRO',
            subscriptionId: 'sub_123',
            currentPeriodEnd: new Date(Date.now() + 86400000),
        };
        (stripe.subscriptions.retrieve as jest.Mock).mockRejectedValue(new Error('Stripe network error'));
        (prisma.workspace.update as jest.Mock).mockResolvedValue({});

        await expect(performScheduleDowngrade(workspace as never, 'BASIC')).rejects.toMatchObject({
            status: 502,
            message: 'Could not schedule plan change with payment provider. Try again later.',
        });
    });
});
