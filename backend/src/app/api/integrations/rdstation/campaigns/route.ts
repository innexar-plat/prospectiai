import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getValidRdStationAccessToken, forceRefreshRdTokenIfPossible } from '@/lib/rdstation-oauth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let token = await getValidRdStationAccessToken(session.user.id);
    if (!token) {
      return NextResponse.json({ error: 'RD Station não configurado' }, { status: 422 });
    }

    const doFetch = async (accessToken: string) =>
      fetch('https://api.rd.services/crm/v2/campaigns?page[number]=1&page[size]=200', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

    let res = await doFetch(token);

    if (res.status === 401) {
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      const hasRefresh = !!(user as unknown as { rdStationRefreshToken?: string | null }).rdStationRefreshToken;
      if (hasRefresh) {
        const refreshed = await forceRefreshRdTokenIfPossible(session.user.id);
        if (refreshed) {
          token = refreshed;
          res = await doFetch(token);
        }
      }
    }

    if (!res.ok) {
      return NextResponse.json({ error: `RD Station retornou ${res.status}` }, { status: res.status === 401 ? 401 : 502 });
    }

    const body = await res.json().catch(() => ({ data: [] }));
    return NextResponse.json(body);
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('RD Station campaigns error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
