import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { sendChatMessage } from '@/lib/whatsapp-send';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';
import { z } from 'zod';

const postSchema = z.object({
  contactNumber: z.string().min(8).max(20),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const contactNumber = parsed.data.contactNumber.replace(/\D/g, '');
  const result = await sendChatMessage(
    { provider: config.provider, evolutionInstanceName: config.evolutionInstanceName, metaPhoneNumberId: config.metaPhoneNumberId, whatsappStatus: config.whatsappStatus },
    { adminConfigId: config.id },
    contactNumber,
    parsed.data.message,
  );

  if (!result.ok) {
    const status = result.error === 'WhatsApp not connected' ? 409 : 502;
    return NextResponse.json({ error: result.error, outsideWindow: result.outsideWindow }, { status });
  }

  return NextResponse.json({ ok: true, conversationId: result.conversationId, messageId: result.messageId });
}
