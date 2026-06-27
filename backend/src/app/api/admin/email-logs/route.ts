import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = req.nextUrl;
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
    const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
    const type = url.searchParams.get('type') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const email = url.searchParams.get('email') || undefined;

    try {
        const where = {
            ...(type && { type: type as 'TRANSACTIONAL' | 'CAMPAIGN' | 'WEEKLY_REPORT' | 'SYSTEM' }),
            ...(status && { status: status as 'SENT' | 'FAILED' | 'PENDING' | 'BOUNCED' }),
            ...(email && { email: { contains: email, mode: 'insensitive' as const } }),
        };

        const [items, total] = await Promise.all([
            prisma.emailSendLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.emailSendLog.count({ where }),
        ]);

        return NextResponse.json({ items, total, limit, offset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin email-logs error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
