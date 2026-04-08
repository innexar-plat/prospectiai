import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PLAN_TIER_ORDER, type PlanType } from '@/lib/billing-config';

/** Derive DEFAULT_PLANS from the single source of truth in billing-config.ts */
const MODULE_MAP: Record<string, string[]> = {
    FREE: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    BASIC: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    PRO: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'],
    BUSINESS: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
    SCALE: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
};

const DEFAULT_PLANS = PLAN_TIER_ORDER.map((key, idx) => {
    const p = PLANS[key as PlanType];
    return {
        key,
        name: p.name,
        leadsLimit: p.leadsLimit,
        sortOrder: idx,
        priceMonthlyBrl: p.monthly.price_brl,
        priceAnnualBrl: p.annual.price_brl,
        priceMonthlyUsd: p.monthly.price_usd,
        priceAnnualUsd: p.annual.price_usd,
        modules: MODULE_MAP[key] ?? [],
    };
});

/**
 * GET /api/plans
 * Returns active plans from PlanConfig for display on the dashboard Planos page.
 * Requires authenticated session (no admin). Upserts from billing-config.ts to keep prices in sync.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Upsert plans from billing-config.ts to keep DB in sync with code
    for (const plan of DEFAULT_PLANS) {
        await prisma.planConfig.upsert({
            where: { key: plan.key },
            create: plan,
            update: {
                name: plan.name,
                leadsLimit: plan.leadsLimit,
                priceMonthlyBrl: plan.priceMonthlyBrl,
                priceAnnualBrl: plan.priceAnnualBrl,
                priceMonthlyUsd: plan.priceMonthlyUsd,
                priceAnnualUsd: plan.priceAnnualUsd,
                modules: plan.modules,
                sortOrder: plan.sortOrder,
            },
        });
    }

    const plans = await prisma.planConfig.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
            key: true,
            name: true,
            leadsLimit: true,
            priceMonthlyBrl: true,
            priceAnnualBrl: true,
            modules: true,
        },
    });

    return NextResponse.json(plans);
}
