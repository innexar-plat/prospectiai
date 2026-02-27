import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/** GET /api/notifications — list for current user; ?unreadOnly=true&limit=20 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }
    const unreadOnly = req.nextUrl.searchParams.get('unreadOnly') === 'true';
    const limitParam = req.nextUrl.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam ?? '20', 10) || 20, 100);
    const where = { userId: session.user.id, ...(unreadOnly ? { readAt: null } : {}) };
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, title: true, message: true, type: true, link: true, readAt: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    ]);
    return jsonWithRequestId({ items, unreadCount, limit }, { requestId });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Notifications list error', { error: e instanceof Error ? e.message : 'Unknown' }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
