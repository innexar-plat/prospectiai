import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendChatMessage } from '@/lib/whatsapp-send';
import { z } from 'zod';

const postSchema = z.object({
  contactNumber: z.string().min(8).max(20),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const contactNumber = parsed.data.contactNumber.replace(/\D/g, '');
  const result = await sendChatMessage(
    { provider: rep.whatsappProvider, evolutionInstanceName: rep.evolutionInstanceName, metaPhoneNumberId: rep.metaPhoneNumberId, whatsappStatus: rep.whatsappStatus },
    { representativeId: rep.id },
    contactNumber,
    parsed.data.message,
  );

  if (!result.ok) {
    const status = result.error === 'WhatsApp not connected' ? 409 : 502;
    return NextResponse.json({ error: result.error, outsideWindow: result.outsideWindow }, { status });
  }

  return NextResponse.json({ ok: true, conversationId: result.conversationId, messageId: result.messageId });
}
