import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { adminListQuerySchema, formatZodError } from '@/lib/validations/schemas';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const parsed = adminListQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { limit = DEFAULT_LIMIT, offset = 0 } = parsed.data;
        const safeLimit = Math.min(limit, MAX_LIMIT);
        const safeOffset = Math.max(0, offset);

        const [items, total] = await Promise.all([
            prisma.auditLog.findMany({
                take: safeLimit,
                skip: safeOffset,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    userId: true,
                    adminEmail: true,
                    action: true,
                    resource: true,
                    resourceId: true,
                    details: true,
                    createdAt: true,
                },
            }),
            prisma.auditLog.count(),
        ]);

        logAdminAction(session, 'admin.audit-logs.list', {
            resource: 'audit-logs',
            details: { limit: safeLimit, offset: safeOffset, total },
        }).catch(() => {});
        return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin audit-logs list error', {
            error: e instanceof Error ? e.message : 'Unknown',
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
