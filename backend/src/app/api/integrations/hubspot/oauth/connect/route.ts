import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildHubspotOauthAuthorizeUrl, createHubspotOauthState } from '@/lib/hubspot-oauth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = createHubspotOauthState(session.user.id);
    const url = await buildHubspotOauthAuthorizeUrl(state);

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('HubSpot OAuth connect error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
