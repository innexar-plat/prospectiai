import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { logoutInstance } from '@/lib/evolution';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  if (rep.whatsappProvider === 'META') {
    await prisma.representative.update({
      where: { id: rep.id },
      data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null, metaPhoneNumberId: null },
    });
    return NextResponse.json({ ok: true });
  }

  if (rep.evolutionInstanceName) {
    await logoutInstance(rep.evolutionInstanceName);
  }

  await prisma.representative.update({
    where: { id: rep.id },
    data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null },
  });

  return NextResponse.json({ ok: true });
}
