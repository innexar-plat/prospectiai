import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-prospeccao/reset-sender-counts
 * Reset sentToday counter on all sender pool entries.
 * Should be called once daily (e.g. 00:01).
 */
export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await prisma.autoProspSenderPool.updateMany({
    data: { sentToday: 0, sentTodayResetAt: new Date() },
  });

  return NextResponse.json({ reset: result.count });
}
