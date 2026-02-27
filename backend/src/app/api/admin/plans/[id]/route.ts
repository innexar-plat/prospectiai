import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { z } from 'zod';

const updatePlanSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    leadsLimit: z.coerce.number().int().min(0).optional(),
    priceMonthlyBrl: z.coerce.number().min(0).optional(),
    priceAnnualBrl: z.coerce.number().min(0).optional(),
    priceMonthlyUsd: z.coerce.number().min(0).optional(),
    priceAnnualUsd: z.coerce.number().min(0).optional(),
    modules: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }

    const plan = await prisma.planConfig.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const updated = await prisma.planConfig.update({
        where: { id },
        data: parsed.data,
    });

    logAdminAction(session, 'admin.plans.update', {
        resource: 'plans',
        resourceId: id,
        details: parsed.data,
    }).catch(() => {});

    return NextResponse.json(updated);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;

    const plan = await prisma.planConfig.findUnique({ where: { id } });
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    // Soft delete — mark inactive
    await prisma.planConfig.update({
        where: { id },
        data: { isActive: false },
    });

    logAdminAction(session, 'admin.plans.delete', {
        resource: 'plans',
        resourceId: id,
        details: { key: plan.key },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
}
