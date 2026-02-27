import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { createNotificationForAllUsers } from '@/lib/notification-service';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { NotificationType } from '@prisma/client';

/** POST /api/admin/notifications/send-all — admin only; body: { title, message, link?, type? } */
export async function POST(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id || !(await isAdmin(session))) {
      return jsonWithRequestId({ error: 'Forbidden' }, { status: 403, requestId });
    }
    const body = await req.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!title || !message) {
      return jsonWithRequestId({ error: 'title and message required' }, { status: 400, requestId });
    }
    const link = typeof body.link === 'string' ? body.link.trim() || undefined : undefined;
    const type = [NotificationType.INFO, NotificationType.ALERT, NotificationType.REMINDER, NotificationType.SYSTEM].includes(body.type)
      ? body.type
      : NotificationType.INFO;
    const count = await createNotificationForAllUsers({
      title,
      message,
      link,
      type,
      channel: 'admin_broadcast',
      emailSubject: title,
    });
    return jsonWithRequestId({ sent: count }, { requestId });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Send-all notifications error', { error: e instanceof Error ? e.message : 'Unknown' }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
