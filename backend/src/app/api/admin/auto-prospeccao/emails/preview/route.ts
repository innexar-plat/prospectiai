import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { buildStepPreview } from '@/modules/auto-prospeccao/application/email-sequence.worker';

/** GET /api/admin/auto-prospeccao/emails/preview?workspaceId=...&step=1..3 — what the lead receives. */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  const step = Math.min(3, Math.max(1, Number(req.nextUrl.searchParams.get('step')) || 1));
  return NextResponse.json({ data: await buildStepPreview(workspaceId, step, 'Empresa Exemplo Ltda') });
}
