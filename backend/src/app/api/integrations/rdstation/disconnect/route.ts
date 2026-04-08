import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { clearRdIntegration } from '@/lib/rdstation-oauth';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await clearRdIntegration(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('RD disconnect error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
