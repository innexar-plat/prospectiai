import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { ensureInstance, getQrCode } from '@/lib/evolution';
import { getOrCreateAdminWhatsAppConfig, instanceNameForAdmin } from '@/lib/admin-whatsapp';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const config = await getOrCreateAdminWhatsAppConfig();
  const instanceName = config.evolutionInstanceName ?? instanceNameForAdmin(config.id);

  try {
    await ensureInstance(instanceName);
    const qrCode = await getQrCode(instanceName);

    await prisma.adminWhatsAppConfig.update({
      where: { id: config.id },
      data: { evolutionInstanceName: instanceName, provider: 'EVOLUTION', whatsappStatus: 'CONNECTING' },
    });

    return NextResponse.json({ qrCode, instanceName });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Evolution error' }, { status: 502 });
  }
}
