import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { z } from 'zod';

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
        const defaults = [
            { key: 'FREE', name: 'Free', leadsLimit: 5, sortOrder: 0, priceMonthlyBrl: 0, priceAnnualBrl: 0, priceMonthlyUsd: 0, priceAnnualUsd: 0, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'] },
            { key: 'BASIC', name: 'Starter', leadsLimit: 100, sortOrder: 1, priceMonthlyBrl: 97, priceAnnualBrl: 989, priceMonthlyUsd: 19, priceAnnualUsd: 193, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'] },
            { key: 'PRO', name: 'Growth', leadsLimit: 400, sortOrder: 2, priceMonthlyBrl: 297, priceAnnualBrl: 3029, priceMonthlyUsd: 59, priceAnnualUsd: 601, modules: ['MAPEAMENTO', 'INTELIGENCIA_LEADS', 'ANALISE_CONCORRENCIA', 'ACAO_COMERCIAL'] },
            { key: 'BUSINESS', name: 'Business', leadsLimit: 1200, sortOrder: 3, priceMonthlyBrl: 997, priceAnnualBrl: 10169, priceMonthlyUsd: 199, priceAnnualUsd: 2029, modules: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'] },
            { key: 'SCALE', name: 'Enterprise', leadsLimit: 5000, sortOrder: 4, priceMonthlyBrl: 2497, priceAnnualBrl: 25469, priceMonthlyUsd: 499, priceAnnualUsd: 5089, modules: ['MAPEAMENTO', 'INTELIGENCIA_MERCADO', 'ANALISE_CONCORRENCIA', 'INTELIGENCIA_LEADS', 'ACAO_COMERCIAL'] },
        ];
        await prisma.planConfig.createMany({ data: defaults });
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
    void logAdminAction(session, 'admin.plans.create', { resource: 'plans', resourceId: plan.id, details: parsed.data });
    return NextResponse.json(plan, { status: 201 });
}
