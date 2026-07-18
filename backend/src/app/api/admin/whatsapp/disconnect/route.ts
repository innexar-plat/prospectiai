import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { logoutInstance } from '@/lib/evolution';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();

  if (config.provider === 'META') {
    await prisma.adminWhatsAppConfig.update({
      where: { id: config.id },
      data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null, metaPhoneNumberId: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (config.evolutionInstanceName) {
    await logoutInstance(config.evolutionInstanceName);
  }

  await prisma.adminWhatsAppConfig.update({
    where: { id: config.id },
    data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null },
  });

  return NextResponse.json({ ok: true });
}
