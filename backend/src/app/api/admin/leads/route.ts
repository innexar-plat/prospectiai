import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { adminListQuerySchema, formatZodError } from '@/lib/validations/schemas';

/**
 * GET /api/admin/leads
 * List lead analyses (all workspaces) with pagination. Admin only.
 * Query: limit (default 20), offset (default 0), workspaceId (optional filter).
 */
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const parsed = adminListQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
            workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
        });
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        const { limit = 20, offset = 0, workspaceId } = parsed.data;
        const safeLimit = Math.min(limit, 100);
        const safeOffset = Math.max(0, offset);
        const where = workspaceId ? { workspaceId } : {};

        const [items, total] = await Promise.all([
            prisma.leadAnalysis.findMany({
                where,
                take: safeLimit,
                skip: safeOffset,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    workspace: { select: { id: true, name: true } },
                    lead: true,
                },
            }),
            prisma.leadAnalysis.count({ where }),
        ]);

        void logAdminAction(session, 'admin.leads.list', { resource: 'leads', details: { limit: safeLimit, offset: safeOffset, total, workspaceId } });
        return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin leads list error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
