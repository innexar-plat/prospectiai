import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { getWorkspaceUsage } from '@/lib/usage';
import { adminListQuerySchema, formatZodError } from '@/lib/validations/schemas';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const parsed = adminListQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
        });
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        const { limit = 20, offset = 0 } = parsed.data;
        const safeLimit = Math.min(limit, 100);
        const safeOffset = Math.max(0, offset);
        const [items, total] = await Promise.all([
            prisma.workspace.findMany({
                take: safeLimit,
                skip: safeOffset,
                orderBy: { createdAt: 'desc' },
                include: {
                _count: { select: { members: true, analyses: true, searchHistory: true } },
            },
            }),
            prisma.workspace.count(),
        ]);
        const usageMap = await getWorkspaceUsage(items.map((w) => w.id));
        const itemsWithUsage = items.map((w) => ({ ...w, usage: usageMap.get(w.id) ?? null }));
        void logAdminAction(session, 'admin.workspaces.list', { resource: 'workspaces', details: { limit: safeLimit, offset: safeOffset, total } });
        return NextResponse.json({ items: itemsWithUsage, total, limit: safeLimit, offset: safeOffset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin workspaces list error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
