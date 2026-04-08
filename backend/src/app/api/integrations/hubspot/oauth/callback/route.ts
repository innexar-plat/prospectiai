import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exchangeHubspotCodeForTokens, saveOAuthHubspotTokens, verifyHubspotOauthState } from '@/lib/hubspot-oauth';

function integrationsRedirect(params: Record<string, string>): string {
  const base = process.env.AUTH_URL ?? process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = new URL('/dashboard/integracoes', base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(integrationsRedirect({ hubspot: 'error', reason: 'missing_code_or_state' }));
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(integrationsRedirect({ hubspot: 'error', reason: 'unauthorized' }));
    }

    const parsed = verifyHubspotOauthState(state);
    if (parsed.userId !== session.user.id) {
      return NextResponse.redirect(integrationsRedirect({ hubspot: 'error', reason: 'invalid_state_user' }));
    }

    const tokens = await exchangeHubspotCodeForTokens(code);
    await saveOAuthHubspotTokens(session.user.id, tokens);

    return NextResponse.redirect(integrationsRedirect({ hubspot: 'connected', mode: 'oauth' }));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('HubSpot OAuth callback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.redirect(integrationsRedirect({ hubspot: 'error', reason: 'oauth_callback_failed' }));
  }
}
