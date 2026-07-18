import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isMetaWhatsAppConfigured } from '@/lib/whatsapp-meta';
import { z } from 'zod';

const postSchema = z.object({
  phoneNumberId: z.string().min(1).max(100),
  phoneNumber: z.string().max(50).optional(),
});

/**
 * Registers this representative's WhatsApp Cloud API phone number. The number itself must
 * already be added to the company's WhatsApp Business Account in Meta Business Suite —
 * this endpoint only records the phone_number_id so we know where to route messages.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isMetaWhatsAppConfigured()) {
    return NextResponse.json({ error: 'Meta WhatsApp Cloud API not configured on this server' }, { status: 501 });
  }

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.representative.findUnique({ where: { metaPhoneNumberId: parsed.data.phoneNumberId } });
  if (existing && existing.id !== rep.id) {
    return NextResponse.json({ error: 'This phone number is already connected to another representative' }, { status: 409 });
  }

  await prisma.representative.update({
    where: { id: rep.id },
    data: {
      whatsappProvider: 'META',
      metaPhoneNumberId: parsed.data.phoneNumberId,
      whatsappNumber: parsed.data.phoneNumber ?? rep.whatsappNumber,
      whatsappStatus: 'CONNECTED',
      whatsappConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
