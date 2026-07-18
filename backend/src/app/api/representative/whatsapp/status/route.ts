import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getInstanceStatus } from '@/lib/evolution';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({ where: { userId: session.user.id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  if (rep.whatsappProvider === 'META') {
    // Meta numbers don't have a live "connection state" to poll — once registered, they're
    // always CONNECTED (subject to Meta's own account/number health, which we can't query here).
    return NextResponse.json({
      status: rep.metaPhoneNumberId ? rep.whatsappStatus : 'DISCONNECTED',
      number: rep.whatsappNumber,
      provider: 'META',
    });
  }

  if (!rep.evolutionInstanceName) {
    return NextResponse.json({ status: 'DISCONNECTED', number: null, provider: 'EVOLUTION' });
  }

  try {
    const state = await getInstanceStatus(rep.evolutionInstanceName);
    let status = rep.whatsappStatus;

    if (state === 'open' && status !== 'CONNECTED') {
      status = 'CONNECTED';
      await prisma.representative.update({
        where: { id: rep.id },
        data: { whatsappStatus: 'CONNECTED', whatsappConnectedAt: new Date() },
      });
    } else if (state === 'close' && status !== 'DISCONNECTED') {
      status = 'DISCONNECTED';
      await prisma.representative.update({
        where: { id: rep.id },
        data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null },
      });
    } else if (state === 'connecting' && status !== 'CONNECTING') {
      status = 'CONNECTING';
      await prisma.representative.update({ where: { id: rep.id }, data: { whatsappStatus: 'CONNECTING' } });
    }

    return NextResponse.json({ status, number: rep.whatsappNumber, provider: 'EVOLUTION' });
  } catch {
    return NextResponse.json({ status: rep.whatsappStatus, number: rep.whatsappNumber, provider: 'EVOLUTION' });
  }
}
