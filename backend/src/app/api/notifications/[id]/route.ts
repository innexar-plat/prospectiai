import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/** PATCH /api/notifications/[id] — mark as read (user must own notification) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }
    const { id } = await params;
    const notification = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!notification) {
      return jsonWithRequestId({ error: 'Not found' }, { status: 404, requestId });
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
      select: { id: true, readAt: true, link: true },
    });
    return jsonWithRequestId(updated, { requestId });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Notification mark read error', { error: e instanceof Error ? e.message : 'Unknown' }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
