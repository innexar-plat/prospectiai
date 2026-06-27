import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { PLANS, PLAN_TIER_ORDER, type PlanType } from '@/lib/billing-config';
import { z } from 'zod';

const MODULE_MAP: Record<string, string[]> = {
    FREE: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    BASIC: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    PRO: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'],
    BUSINESS: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
    SCALE: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
};

const DEFAULT_PLANS = PLAN_TIER_ORDER.map((key, idx) => {
    const plan = PLANS[key as PlanType];
    return {
        key,
        name: plan.name,
        leadsLimit: plan.leadsLimit,
        sortOrder: idx,
        priceMonthlyBrl: plan.monthly.price_brl,
        priceAnnualBrl: plan.annual.price_brl,
        priceMonthlyUsd: plan.monthly.price_usd,
        priceAnnualUsd: plan.annual.price_usd,
        modules: MODULE_MAP[key] ?? [],
    };
});

const createPlanSchema = z.object({
    key: z.string().min(1).max(50).transform((s) => s.toUpperCase().replace(/\s+/g, '_')),
    name: z.string().min(1).max(200),
    leadsLimit: z.coerce.number().int().min(0).default(10),
    priceMonthlyBrl: z.coerce.number().min(0).default(0),
    priceAnnualBrl: z.coerce.number().min(0).default(0),
    priceMonthlyUsd: z.coerce.number().min(0).default(0),
    priceAnnualUsd: z.coerce.number().min(0).default(0),
    modules: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
});

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const plans = await prisma.planConfig.findMany({
        orderBy: { sortOrder: 'asc' },
    });

    if (plans.length === 0) {
        await prisma.planConfig.createMany({ data: DEFAULT_PLANS });
        const seeded = await prisma.planConfig.findMany({ orderBy: { sortOrder: 'asc' } });
        return NextResponse.json(seeded);
    }

    return NextResponse.json(plans);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }

    const existing = await prisma.planConfig.findUnique({ where: { key: parsed.data.key } });
    if (existing) {
        return NextResponse.json({ error: `Plan with key "${parsed.data.key}" already exists` }, { status: 409 });
    }

    const plan = await prisma.planConfig.create({ data: parsed.data });
    logAdminAction(session, 'admin.plans.create', { resource: 'plans', resourceId: plan.id, details: parsed.data }).catch(() => {});
    return NextResponse.json(plan, { status: 201 });
}
