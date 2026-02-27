import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { getChannelsWithConfig, NOTIFICATION_CHANNELS } from '@/lib/notification-service';
import { z } from 'zod';

const patchBodySchema = z.object({
  key: z.string().min(1),
  appEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
});

/**
 * GET /api/admin/notification-channels
 * List all notification channels with appEnabled/emailEnabled from DB. Admin only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const channels = await getChannelsWithConfig();
    return NextResponse.json({ channels });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin notification-channels list error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/notification-channels
 * Upsert one channel config (appEnabled / emailEnabled). Admin only.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body: key required, appEnabled/emailEnabled optional' }, { status: 400 });
    }
    const { key, appEnabled, emailEnabled } = parsed.data;
    const known = NOTIFICATION_CHANNELS.some((ch) => ch.key === key);
    if (!known) {
      return NextResponse.json({ error: 'Unknown channel key' }, { status: 400 });
    }
    const name = NOTIFICATION_CHANNELS.find((ch) => ch.key === key)!.name;
    const updated = await prisma.notificationChannelConfig.upsert({
      where: { key },
      create: {
        key,
        name,
        appEnabled: appEnabled ?? true,
        emailEnabled: emailEnabled ?? true,
      },
      update: {
        ...(appEnabled !== undefined && { appEnabled }),
        ...(emailEnabled !== undefined && { emailEnabled }),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin notification-channels patch error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
