import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { markConversationRead } from '@/lib/whatsapp-chat';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const { id } = await params;
  const updated = await markConversationRead(id, { representativeId: rep.id });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
