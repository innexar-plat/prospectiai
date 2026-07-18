import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { getInstanceStatus } from '@/lib/evolution';
import { getOrCreateAdminWhatsAppConfig } from '@/lib/admin-whatsapp';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();

  if (config.provider === 'META') {
    return NextResponse.json({
      status: config.metaPhoneNumberId ? config.whatsappStatus : 'DISCONNECTED',
      number: config.whatsappNumber,
      provider: 'META',
    });
  }

  if (!config.evolutionInstanceName) {
    return NextResponse.json({ status: 'DISCONNECTED', number: null, provider: 'EVOLUTION' });
  }

  try {
    const state = await getInstanceStatus(config.evolutionInstanceName);
    let status = config.whatsappStatus;

    if (state === 'open' && status !== 'CONNECTED') {
      status = 'CONNECTED';
      await prisma.adminWhatsAppConfig.update({
        where: { id: config.id },
        data: { whatsappStatus: 'CONNECTED', whatsappConnectedAt: new Date() },
      });
    } else if (state === 'close' && status !== 'DISCONNECTED') {
      status = 'DISCONNECTED';
      await prisma.adminWhatsAppConfig.update({
        where: { id: config.id },
        data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null },
      });
    } else if (state === 'connecting' && status !== 'CONNECTING') {
      status = 'CONNECTING';
      await prisma.adminWhatsAppConfig.update({ where: { id: config.id }, data: { whatsappStatus: 'CONNECTING' } });
    }

    return NextResponse.json({ status, number: config.whatsappNumber, provider: 'EVOLUTION' });
  } catch {
    return NextResponse.json({ status: config.whatsappStatus, number: config.whatsappNumber, provider: 'EVOLUTION' });
  }
}
