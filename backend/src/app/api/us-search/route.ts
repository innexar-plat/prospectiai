import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { assertWorkspaceCanUseProduct } from '@/lib/trial';
import { US_SEGMENTS, searchUsCompanies } from '@/lib/us-query';

const schema = z.object({
    segment: z.string().max(60),
    state: z.string().regex(/^[A-Za-z]{2}$/),
    city: z.string().max(100).optional(),
    hasPhone: z.boolean().optional(),
    hasEmail: z.boolean().optional(),
    hasWebsite: z.boolean().optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
});

/** GET /api/us-search — segments for the picker. */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ segments: US_SEGMENTS.map(({ slug, name }) => ({ slug, name })) });
}

/** POST /api/us-search — US business base. One credit per new search (page 1); paging is free. */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    const { segment, state, city, hasPhone, hasEmail, hasWebsite, page, pageSize } = parsed.data;
    const seg = US_SEGMENTS.find((s) => s.slug === segment);
    if (!seg) return NextResponse.json({ error: 'Unknown industry' }, { status: 400 });

    const membership = await prisma.workspaceMember.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'asc' },
        select: { workspace: { select: { id: true, plan: true, leadsUsed: true, leadsLimit: true, subscriptionStatus: true, currentPeriodEnd: true } } },
    });
    const ws = membership?.workspace;
    if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const gate = assertWorkspaceCanUseProduct(ws);
    if (!gate.ok) return NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 });
    // Paging is free only for someone who still has a plan; the first page needs a credit.
    if (page === 1 && ws.leadsUsed >= ws.leadsLimit) return NextResponse.json({ error: 'Limit reached', code: 'LIMIT_EXCEEDED' }, { status: 403 });

    try {
        const r = await searchUsCompanies({ categories: seg.categories, states: [state], city, hasPhone, hasEmail, hasWebsite }, page, pageSize);
        if (page === 1 && r.companies.length > 0) {
            await prisma.workspace.update({ where: { id: ws.id }, data: { leadsUsed: { increment: 1 } } });
        }
        return NextResponse.json({
            ...r,
            companies: r.companies.map((c) => ({
                id: c.id, name: c.name, category: c.category, address: c.address, city: c.city, state: c.state,
                postcode: c.postcode, phone: c.phone, email: c.email, website: c.website,
            })),
        });
    } catch (error) {
        logger.error('US search failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Search is busy right now. Try adding a city.' }, { status: 503 });
    }
}
