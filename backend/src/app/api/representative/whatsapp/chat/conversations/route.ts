import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(30),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 30,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }
  const { limit, offset } = parsed.data;

  const where = { representativeId: rep.id };
  const [items, total] = await Promise.all([
    prisma.whatsAppConversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
      include: { repClient: { select: { id: true, name: true, company: true } } },
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
      repClientId: c.repClientId,
      repClientName: c.repClient?.name ?? null,
      repClientCompany: c.repClient?.company ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
    total,
    limit,
    offset,
  });
}
