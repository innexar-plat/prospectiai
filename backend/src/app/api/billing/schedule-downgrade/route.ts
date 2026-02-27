import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PlanType } from '@/lib/billing-config';
import { logger } from '@/lib/logger';
import { scheduleDowngradeSchema, formatZodError } from '@/lib/validations/schemas';
import { performScheduleDowngrade, type ScheduleDowngradeError } from '@/lib/schedule-downgrade';

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = scheduleDowngradeSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { planId: targetPlanId } = parsed.data;

        if (targetPlanId === 'FREE') {
            return NextResponse.json(
                { error: 'Use cancel flow to switch to Free. Schedule downgrade is for paid plans only.' },
                { status: 400 }
            );
        }

        if (!PLANS[targetPlanId as PlanType]) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1, include: { workspace: true } } },
        });

        const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;
        if (!workspace) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
        }

        const result = await performScheduleDowngrade(
            {
                id: workspace.id,
                plan: workspace.plan,
                subscriptionId: workspace.subscriptionId,
                currentPeriodEnd: workspace.currentPeriodEnd,
            },
            targetPlanId
        );

        return NextResponse.json({
            ok: true,
            message: result.message,
            pendingPlanId: result.pendingPlanId,
            pendingPlanEffectiveAt: result.pendingPlanEffectiveAt,
        });
    } catch (err: unknown) {
        const known = err as ScheduleDowngradeError;
        if (typeof known.status === 'number' && typeof known.error === 'string') {
            return NextResponse.json({ error: known.error }, { status: known.status });
        }
        logger.error('Schedule downgrade error', { error: err instanceof Error ? err.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to schedule downgrade' }, { status: 500 });
    }
}
