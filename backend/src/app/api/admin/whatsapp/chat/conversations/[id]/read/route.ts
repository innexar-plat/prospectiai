import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { markConversationRead } from '@/lib/whatsapp-chat';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();
  const { id } = await params;
  const updated = await markConversationRead(id, { adminConfigId: config.id });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
