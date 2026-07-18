import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureInstance, getQrCode, instanceNameForRep } from '@/lib/evolution';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true, evolutionInstanceName: true },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const instanceName = rep.evolutionInstanceName ?? instanceNameForRep(rep.id);

  try {
    await ensureInstance(instanceName);
    const qrCode = await getQrCode(instanceName);

    await prisma.representative.update({
      where: { id: rep.id },
      data: { evolutionInstanceName: instanceName, whatsappStatus: 'CONNECTING' },
    });

    return NextResponse.json({ qrCode, instanceName });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Evolution error' }, { status: 502 });
  }
}
