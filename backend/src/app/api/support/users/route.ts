import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSupport } from '@/lib/admin';
import { logSupportAction } from '@/lib/audit';
import { supportUsersListSchema, formatZodError } from '@/lib/validations/schemas';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSupport(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const rawSearch = req.nextUrl.searchParams.get('search');
        const searchParam = rawSearch?.trim() || undefined;
        const parsed = supportUsersListSchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
            search: searchParam,
        });
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { limit = 20, offset = 0, search } = parsed.data;
        const safeLimit = Math.min(limit, 100);
        const safeOffset = Math.max(0, offset);
        const searchTerm = search?.trim();
        const where = searchTerm
            ? {
                  OR: [
                      { name: { contains: searchTerm, mode: 'insensitive' as const } },
                      { email: { contains: searchTerm, mode: 'insensitive' as const } },
                  ],
              }
            : {};

        const [items, total] = await Promise.all([
            prisma.user.findMany({
                where,
                take: safeLimit,
                skip: safeOffset,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    plan: true,
                    disabledAt: true,
                    createdAt: true,
                },
            }),
            prisma.user.count({ where }),
        ]);
        logSupportAction(session, 'support.users.list', {
            resource: 'users',
            details: { limit: safeLimit, offset: safeOffset, total, search: searchTerm ?? undefined },
        }).catch(() => {});
        return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Support users list error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
