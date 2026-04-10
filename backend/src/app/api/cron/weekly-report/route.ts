import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { weeklyReportTemplate, type WeeklyReportConfig, type AdminWeeklyReportConfig } from '@/lib/email-templates';
import { getWeeklyReportConfig } from '@/modules/email-marketing';
import { logger } from '@/lib/logger';

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

/**
 * POST /api/cron/weekly-report
 * Send weekly reports to users who opted in. Should run once a week.
 */
export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const config = await getWeeklyReportConfig();
    if (!config.enabled) {
      return NextResponse.json({ message: 'Weekly report is disabled', sent: 0 });
    }

    // Get users who want weekly reports
    const users = await prisma.user.findMany({
      where: {
        notifyWeeklyReport: true,
        email: { not: null },
        disabledAt: null,
      },
      select: { id: true, name: true, email: true },
    });

    // Filter out unsubscribed users
    const emails = users.map(u => u.email!).filter(Boolean);
    const unsubscribed = new Set(
      (await prisma.emailUnsubscribe.findMany({
        where: {
          email: { in: emails },
          category: { in: ['ALL', 'WEEKLY_REPORT'] },
        },
        select: { email: true },
      })).map(u => u.email),
    );

    const eligible = users.filter(u => u.email && !unsubscribed.has(u.email));
    logger.info('Sending weekly reports', { total: eligible.length });

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const adminConfig: AdminWeeklyReportConfig = {
      customTitle: config.customTitle ?? undefined,
      customHighlight: config.customHighlight ?? undefined,
      ctaLabel: config.ctaLabel ?? undefined,
      ctaUrl: config.ctaUrl ?? undefined,
      footerPromo: config.footerPromo ?? undefined,
    };

    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (user) => {
        try {
          // Compute per-user metrics
          const [searchCount, leadAnalyses] = await Promise.all([
            prisma.searchHistory.count({
              where: { userId: user.id, createdAt: { gte: weekStart } },
            }),
            prisma.leadAnalysis.findMany({
              where: { userId: user.id, createdAt: { gte: weekStart } },
              select: { score: true, lead: { select: { types: true, address: true } } },
            }),
          ]);

          const totalLeads = leadAnalyses.length;
          const scores = leadAnalyses.map(a => a.score ?? 0);
          const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const hotLeads = scores.filter(s => s >= 80).length;
          const warmLeads = scores.filter(s => s >= 50 && s < 80).length;
          const coldLeads = scores.filter(s => s < 50).length;

          // Top segment and city
          const segments: Record<string, number> = {};
          const cities: Record<string, number> = {};
          leadAnalyses.forEach(a => {
            const typesArr = Array.isArray(a.lead?.types) ? a.lead.types as string[] : [];
            const cat = typesArr[0] ?? 'Outros';
            // Extract city from address (format: "Street, City - State, Country")
            const addr = a.lead?.address ?? '';
            const cityMatch = addr.match(/,\s*([^,-]+)\s*-/);
            const city = cityMatch?.[1]?.trim() ?? 'N/A';
            segments[cat] = (segments[cat] ?? 0) + 1;
            cities[city] = (cities[city] ?? 0) + 1;
          });

          const topSegment = Object.entries(segments).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';
          const topCity = Object.entries(cities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

          const reportData: WeeklyReportConfig = {
            userName: user.name ?? 'Usuário',
            weekStart,
            weekEnd: now,
            totalSearches: searchCount,
            totalLeadsFound: totalLeads,
            hotLeads,
            warmLeads,
            coldLeads,
            avgScore,
            topSegment,
            topCity,
            dashboardUrl: '/dashboard',
          };

          const html = weeklyReportTemplate(reportData, adminConfig);
          const result = await sendEmail(user.email!, `Seu resumo semanal — PrecisionAI`, html);

          if (result.sent) totalSent++;
          else totalFailed++;

          await prisma.emailSendLog.create({
            data: {
              type: 'WEEKLY_REPORT',
              userId: user.id,
              email: user.email!,
              subject: 'Seu resumo semanal — PrecisionAI',
              status: result.sent ? 'SENT' : 'FAILED',
              error: result.error,
            },
          });
        } catch (err) {
          totalFailed++;
          logger.error('Weekly report send error', {
            userId: user.id,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }));

      if (i + BATCH_SIZE < eligible.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    logger.info('Weekly reports sent', { totalSent, totalFailed });
    return NextResponse.json({ sent: totalSent, failed: totalFailed, eligible: eligible.length });
  } catch (e) {
    logger.error('Weekly report cron error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
