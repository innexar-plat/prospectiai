import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_PLANS = [
    { key: 'FREE', name: 'Free', leadsLimit: 5, sortOrder: 0, priceMonthlyBrl: 0, priceAnnualBrl: 0, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'] },
    { key: 'BASIC', name: 'Starter', leadsLimit: 100, sortOrder: 1, priceMonthlyBrl: 97, priceAnnualBrl: 989, priceMonthlyUsd: 19, priceAnnualUsd: 193, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'] },
    { key: 'PRO', name: 'Growth', leadsLimit: 400, sortOrder: 2, priceMonthlyBrl: 297, priceAnnualBrl: 3029, priceMonthlyUsd: 59, priceAnnualUsd: 601, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'] },
    { key: 'BUSINESS', name: 'Business', leadsLimit: 1200, sortOrder: 3, priceMonthlyBrl: 997, priceAnnualBrl: 10169, priceMonthlyUsd: 199, priceAnnualUsd: 2029, modules: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'] },
    { key: 'SCALE', name: 'Enterprise', leadsLimit: 5000, sortOrder: 4, priceMonthlyBrl: 2497, priceAnnualBrl: 25469, priceMonthlyUsd: 499, priceAnnualUsd: 5089, modules: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'] },
];

/**
 * GET /api/plans
 * Returns active plans from PlanConfig for display on the dashboard Planos page.
 * Requires authenticated session (no admin). Seeds defaults if table is empty.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let plans = await prisma.planConfig.findMany({
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

    if (plans.length === 0) {
        await prisma.planConfig.createMany({ data: DEFAULT_PLANS });
        const seeded = await prisma.planConfig.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: { key: true, name: true, leadsLimit: true, priceMonthlyBrl: true, priceAnnualBrl: true, modules: true },
        });
        return NextResponse.json(seeded);
    }

    return NextResponse.json(plans);
}
