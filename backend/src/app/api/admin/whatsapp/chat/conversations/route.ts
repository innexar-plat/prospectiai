import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';
import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(30),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 30,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  const { limit, offset } = parsed.data;

  const where = { adminConfigId: config.id };
  const [items, total] = await Promise.all([
    prisma.whatsAppConversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    }),
    prisma.whatsAppConversation.count({ where }),
  ]);

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      contactNumber: c.contactNumber,
      contactName: c.contactName,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      lastMessagePreview: c.lastMessagePreview,
      unreadCount: c.unreadCount,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
}
