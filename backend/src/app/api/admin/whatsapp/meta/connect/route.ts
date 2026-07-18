import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { isMetaWhatsAppConfigured } from '@/lib/whatsapp-meta';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';
import { z } from 'zod';

const postSchema = z.object({
  phoneNumberId: z.string().min(1).max(100),
  phoneNumber: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!isMetaWhatsAppConfigured()) {
    return NextResponse.json({ error: 'Meta WhatsApp Cloud API not configured on this server' }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const config = await getOrCreateAdminWhatsAppConfig();

  const existing = await prisma.representative.findUnique({ where: { metaPhoneNumberId: parsed.data.phoneNumberId } });
  if (existing) {
    return NextResponse.json({ error: 'This phone number is already connected to a representative' }, { status: 409 });
  }

  await prisma.adminWhatsAppConfig.update({
    where: { id: config.id },
    data: {
      provider: 'META',
      metaPhoneNumberId: parsed.data.phoneNumberId,
      whatsappNumber: parsed.data.phoneNumber ?? config.whatsappNumber,
      whatsappStatus: 'CONNECTED',
      whatsappConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
