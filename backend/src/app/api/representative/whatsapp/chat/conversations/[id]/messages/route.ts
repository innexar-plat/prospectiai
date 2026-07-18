import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const { id } = await params;
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id }, select: { representativeId: true } });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (conversation.representativeId !== rep.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 50,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 });
  }
  const { limit, offset } = parsed.data;

  const [items, total] = await Promise.all([
    prisma.whatsAppMessage.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.whatsAppMessage.count({ where: { conversationId: id } }),
  ]);

  return NextResponse.json({
    items: items.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    })).reverse(),
    total,
    limit,
    offset,
  });
}
