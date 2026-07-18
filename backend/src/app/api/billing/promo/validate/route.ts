import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
    buildPromoCheckoutContext,
    canApplyStarterPromo,
    getStarterPromoPublicInfo,
    resolvePromoIdFromInput,
    verifyPromoToken,
} from '@/lib/billing-promo';
import { getRequestMarket } from '@/lib/market';

/**
 * GET /api/billing/promo/validate?promo=starter-6m
 * GET /api/billing/promo/validate?promo=reactivation
 * GET /api/billing/promo/validate?token=<signed>
 */
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const market = getRequestMarket(req);
    const url = new URL(req.url);
    const promoParam = url.searchParams.get('promo');
    const tokenParam = url.searchParams.get('token');

    let promoId = resolvePromoIdFromInput(promoParam);
    if (!promoId && tokenParam) {
        const verified = verifyPromoToken(tokenParam, session.user.id);
        if (!verified.valid) {
            return NextResponse.json(
                { eligible: false, error: 'Invalid or expired promo token', reason: verified.reason },
                { status: 400 },
            );
        }
        promoId = verified.promoId ?? null;
    }

    if (!promoId) {
        return NextResponse.json({ eligible: false, error: 'Unknown promo' }, { status: 400 });
    }

    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1, include: { workspace: true } } },
    });
    const workspace = userWithWorkspace?.workspaces?.[0]?.workspace;

    const eligible = workspace
        ? canApplyStarterPromo(workspace, market, 'monthly')
        : market === 'BR';

    if (tokenParam && eligible && workspace && promoId === 'starter-6m') {
        await prisma.workspace.update({
            where: { id: workspace.id },
            data: { starterPromoEligible: true },
        });
    }

    const promo = getStarterPromoPublicInfo(eligible);
    const ctx = buildPromoCheckoutContext(promoId);

    return NextResponse.json({
        eligible,
        promo,
        planKey: ctx.planId,
        priceMonthlyBrl: ctx.priceBrl,
        regularPriceMonthlyBrl: ctx.regularPriceBrl,
        months: ctx.months,
        checkoutPlanId: promo.planId,
    });
}
