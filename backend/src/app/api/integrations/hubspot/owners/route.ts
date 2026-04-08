/**
 * GET /api/integrations/hubspot/owners — List HubSpot owners
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getValidHubspotAccessToken } from '@/lib/hubspot-oauth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getValidHubspotAccessToken(session.user.id);
    if (!token) {
      return NextResponse.json({ error: 'HubSpot não conectado.' }, { status: 422 });
    }

    const res = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const body = (await res.json().catch(() => ({}))) as { results?: Array<{ id?: string; firstName?: string; lastName?: string; email?: string }> };
    const owners = (body.results ?? []).map((o) => ({
      id: o.id ?? '',
      label: [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || o.id || '',
    }));

    return NextResponse.json({ data: owners });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('HubSpot owners error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
