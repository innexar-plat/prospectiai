import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { countAgendorConnectedUsers } from '@/lib/agendor-config';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [connectedUsers, totalUsers] = await Promise.all([
      countAgendorConnectedUsers(),
      prisma.user.count(),
    ]);

    const percentConnected = totalUsers > 0 ? Math.round((connectedUsers / totalUsers) * 1000) / 10 : 0;

    return NextResponse.json({
      connectedUsers,
      totalUsers,
      percentConnected,
      usesEnvFallback: Boolean(process.env.AGENDOR_API_TOKEN?.trim()),
    });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Agendor observability error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
