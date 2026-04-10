import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

/**
 * GET /api/admin/stats/history?days=7
 * Returns daily counts for users, analyses, searches, and usage events.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '7', 10) || 7, 1), 90);

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const [usersByDay, analysesByDay, searchesByDay, usageByDay] = await Promise.all([
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "LeadAnalysis"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::bigint as count
        FROM "SearchHistory"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date
      `,
      prisma.$queryRaw<{ date: Date; type: string; total: bigint }[]>`
        SELECT DATE("createdAt") as date, type, SUM(quantity)::bigint as total
        FROM "UsageEvent"
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt"), type
        ORDER BY date
      `,
    ]);

    // Build a filled array with all days (including zeros)
    const dates: string[] = [];
    const d = new Date(since);
    const now = new Date();
    while (d <= now) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }

    const toMap = (rows: { date: Date; count: bigint }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(new Date(r.date).toISOString().slice(0, 10), Number(r.count));
      return m;
    };

    const usersMap = toMap(usersByDay);
    const analysesMap = toMap(analysesByDay);
    const searchesMap = toMap(searchesByDay);

    // Usage by day+type
    const usageMap = new Map<string, Record<string, number>>();
    for (const r of usageByDay) {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!usageMap.has(key)) usageMap.set(key, {});
      usageMap.get(key)![r.type] = Number(r.total);
    }

    const series = dates.map((date) => {
      const usage = usageMap.get(date) ?? {};
      return {
        date,
        users: usersMap.get(date) ?? 0,
        analyses: analysesMap.get(date) ?? 0,
        searches: searchesMap.get(date) ?? 0,
        googleSearch: usage.GOOGLE_PLACES_SEARCH ?? 0,
        googleDetails: usage.GOOGLE_PLACES_DETAILS ?? 0,
        serper: usage.SERPER_REQUEST ?? 0,
      };
    });

    return NextResponse.json({ days, series });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin stats history error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
