import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendChatMessage } from '@/lib/whatsapp-send';
import { z } from 'zod';

const postSchema = z.object({
  repClientId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
  if (rep.whatsappStatus !== 'CONNECTED') {
    return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const client = await prisma.repClient.findUnique({ where: { id: parsed.data.repClientId } });
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  if (client.representativeId !== rep.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!client.phone) return NextResponse.json({ error: 'Client has no phone number' }, { status: 400 });

  const result = await sendChatMessage(
    { provider: rep.whatsappProvider, evolutionInstanceName: rep.evolutionInstanceName, metaPhoneNumberId: rep.metaPhoneNumberId, whatsappStatus: rep.whatsappStatus },
    { representativeId: rep.id },
    client.phone.replace(/\D/g, ''),
    parsed.data.message,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error, outsideWindow: result.outsideWindow }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
