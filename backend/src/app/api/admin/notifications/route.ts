import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { adminListQuerySchema, formatZodError } from '@/lib/validations/schemas';
import { NotificationType } from '@prisma/client';
import { z } from 'zod';

const typeEnum = z.enum(['INFO', 'ALERT', 'REMINDER', 'SYSTEM']);

/**
 * GET /api/admin/notifications
 * List notifications with pagination and optional filters (userId, type). Admin only.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const parsed = adminListQuerySchema.safeParse({
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
      offset: req.nextUrl.searchParams.get('offset') ?? undefined,
      workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    const userId = req.nextUrl.searchParams.get('userId')?.trim() || undefined;
    const typeParam = req.nextUrl.searchParams.get('type')?.trim();
    const typeOk = typeParam ? typeEnum.safeParse(typeParam) : null;
    const type = typeOk?.success ? (typeOk.data as NotificationType) : undefined;

    const { limit = 20, offset = 0 } = parsed.data;
    const safeLimit = Math.min(limit, 100);
    const safeOffset = Math.max(0, offset);
    const where = {
      ...(userId ? { userId } : {}),
      ...(type ? { type } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
        skip: safeOffset,
        select: {
          id: true,
          userId: true,
          workspaceId: true,
          title: true,
          message: true,
          type: true,
          link: true,
          readAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);
    return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin notifications list error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
