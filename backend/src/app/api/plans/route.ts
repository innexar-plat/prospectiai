import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { PLANS, PLAN_TIER_ORDER, PUBLIC_PLAN_KEYS, type PlanType } from '@/lib/billing-config';
import { getMarketLeadsLimit, getRequestMarket } from '@/lib/market';
import { canApplyStarterPromo, getStarterPromoPublicInfo } from '@/lib/billing-promo';

function buildDefaultPlans(market: ReturnType<typeof getRequestMarket>) {
    return PLAN_TIER_ORDER.map((key, idx) => {
        const p = PLANS[key as PlanType];
        const isPublic = PUBLIC_PLAN_KEYS.includes(key as PlanType);
        return {
            key,
            name: p.name,
            leadsLimit: getMarketLeadsLimit(key as PlanType, market),
            sortOrder: idx,
            priceMonthlyBrl: p.monthly.price_brl,
            priceAnnualBrl: p.annual.price_brl,
            priceMonthlyUsd: p.monthly.price_usd,
            priceAnnualUsd: p.annual.price_usd,
            isActive: isPublic,
        };
    });
}

const MODULE_MAP: Record<string, string[]> = {
    FREE: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    TRIAL: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'],
    BASIC: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
    PRO: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'],
    BUSINESS: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
    SCALE: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'],
};

/**
 * GET /api/plans
 * Returns active plans from PlanConfig for display on the dashboard Planos page.
 * Requires authenticated session (no admin). Upserts from billing-config.ts to keep prices in sync.
 */
export async function GET(req: Request) {
    const market = getRequestMarket(req);
    const DEFAULT_PLANS = buildDefaultPlans(market).map((plan) => ({
        ...plan,
        modules: MODULE_MAP[plan.key] ?? [],
    }));
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1, include: { workspace: true } } },
    });
    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;
    const promoEligible = workspace ? canApplyStarterPromo(workspace, market, 'monthly') : false;
    const starterPromo = market === 'BR' ? getStarterPromoPublicInfo(promoEligible) : null;

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
            priceMonthlyUsd: true,
            priceAnnualUsd: true,
            modules: true,
        },
    });

    const currency = market === 'US' ? 'USD' : 'BRL';
    const mapped = plans.map((plan) => ({
        ...plan,
        leadsLimit: getMarketLeadsLimit(plan.key as PlanType, market),
        currency,
        ...(plan.key === 'BASIC' && starterPromo
            ? {
                promo: starterPromo,
                priceMonthlyBrl: promoEligible ? starterPromo.priceMonthlyBrl : plan.priceMonthlyBrl,
            }
            : {}),
    }));

    return NextResponse.json(mapped);
}
