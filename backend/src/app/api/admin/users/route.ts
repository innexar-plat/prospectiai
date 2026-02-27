import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
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
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { limit = 20, offset = 0 } = parsed.data;
        const safeLimit = Math.min(limit, 100);
        const safeOffset = Math.max(0, offset);
        const [items, total] = await Promise.all([
            prisma.user.findMany({
                take: safeLimit,
                skip: safeOffset,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    plan: true,
                    disabledAt: true,
                    onboardingCompletedAt: true,
                    createdAt: true,
                    _count: { select: { workspaces: true, analyses: true, searchHistory: true } },
                },
            }),
            prisma.user.count(),
        ]);
        logAdminAction(session, 'admin.users.list', { resource: 'users', details: { limit: safeLimit, offset: safeOffset, total } }).catch(() => {});
        return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin users list error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
