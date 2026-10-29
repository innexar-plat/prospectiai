import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { getAutoProspEmailStats } from '@/lib/auto-prosp-email-stats';

/** GET /api/admin/auto-prospeccao/emails?workspaceId=... — cold outreach activity. */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  return NextResponse.json({ data: await getAutoProspEmailStats(workspaceId) });
}
