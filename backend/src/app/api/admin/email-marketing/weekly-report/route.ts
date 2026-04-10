import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getWeeklyReportConfig, updateWeeklyReportConfig } from '@/modules/email-marketing';
import { updateWeeklyReportConfigSchema } from '@/modules/email-marketing/domain/types';

/**
 * GET /api/admin/email-marketing/weekly-report
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const config = await getWeeklyReportConfig();
    return NextResponse.json({ data: config });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Get weekly report config error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/email-marketing/weekly-report
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = updateWeeklyReportConfigSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const config = await updateWeeklyReportConfig(parsed.data);
    return NextResponse.json({ data: config });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Update weekly report config error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
