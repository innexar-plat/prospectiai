/**
 * GET /api/integrations/hubspot/pipelines — List HubSpot deal pipelines with stages
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

    const res = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ data: [] });
    }

    const body = (await res.json().catch(() => ({}))) as { results?: Array<{ id?: string; label?: string; stages?: Array<{ id?: string; label?: string }> }> };
    const pipelines = (body.results ?? []).map((p) => ({
      id: p.id ?? '',
      label: p.label ?? '',
      stages: (p.stages ?? []).map((s) => ({ id: s.id ?? '', label: s.label ?? '' })),
    }));

    return NextResponse.json({ data: pipelines });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('HubSpot pipelines error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
