import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { resolveAudience } from '@/modules/email-marketing';

/**
 * POST /api/admin/email-marketing/audience-count
 * Returns the number of users matching the audience criteria.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    const { audience, audienceFilter } = body as { audience: string; audienceFilter?: Record<string, unknown> };
    if (!audience) return NextResponse.json({ error: 'audience is required' }, { status: 400 });

    const count = await resolveAudience(audience, audienceFilter);
    return NextResponse.json({ count });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Audience count error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
