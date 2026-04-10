import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { getWeeklyReportConfig } from '@/modules/email-marketing';
import { weeklyReportTemplate, type WeeklyReportConfig } from '@/lib/email-templates';

/**
 * POST /api/admin/email-marketing/weekly-report/preview
 * Renders a weekly report preview with sample data.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const adminConfig = await getWeeklyReportConfig();
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const sampleData: WeeklyReportConfig = {
      userName: 'Usuário Exemplo',
      weekStart,
      weekEnd: now,
      totalSearches: 15,
      totalLeadsFound: 87,
      hotLeads: 12,
      warmLeads: 35,
      coldLeads: 40,
      avgScore: 72,
      topSegment: 'Restaurantes',
      topCity: 'São Paulo',
      dashboardUrl: '/dashboard',
    };

    const html = weeklyReportTemplate(sampleData, {
      customTitle: adminConfig.customTitle ?? undefined,
      customHighlight: adminConfig.customHighlight ?? undefined,
      ctaLabel: adminConfig.ctaLabel ?? undefined,
      ctaUrl: adminConfig.ctaUrl ?? undefined,
      footerPromo: adminConfig.footerPromo ?? undefined,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Weekly report preview error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
