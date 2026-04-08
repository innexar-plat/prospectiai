import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAgendorApiTokenForUser } from '@/lib/agendor-config';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await getAgendorApiTokenForUser(session.user.id);
    if (!token) {
      return NextResponse.json({ error: 'Agendor não configurado' }, { status: 422 });
    }

    const res = await fetch('https://api.agendor.com.br/v3/funnels', {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Agendor retornou ${res.status}` }, { status: res.status === 401 ? 401 : 502 });
    }

    const body = await res.json().catch(() => ({ data: [] }));
    return NextResponse.json(body);
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Agendor funnels error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
