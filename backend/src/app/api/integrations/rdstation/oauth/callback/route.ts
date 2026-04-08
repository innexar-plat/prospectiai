import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { exchangeRdCodeForTokens, saveOAuthRdTokens, verifyRdOauthState } from '@/lib/rdstation-oauth';

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
    return NextResponse.redirect(integrationsRedirect({ rd: 'error', reason: 'missing_code_or_state' }));
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(integrationsRedirect({ rd: 'error', reason: 'unauthorized' }));
    }

    const parsed = verifyRdOauthState(state);
    if (parsed.userId !== session.user.id) {
      return NextResponse.redirect(integrationsRedirect({ rd: 'error', reason: 'invalid_state_user' }));
    }

    const tokens = await exchangeRdCodeForTokens(code);
    await saveOAuthRdTokens(session.user.id, tokens);

    return NextResponse.redirect(integrationsRedirect({ rd: 'connected', mode: 'oauth' }));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('RD OAuth callback error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.redirect(integrationsRedirect({ rd: 'error', reason: 'oauth_callback_failed' }));
  }
}
