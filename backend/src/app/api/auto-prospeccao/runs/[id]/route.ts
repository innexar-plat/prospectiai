import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../../_helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { id } = await params;
  const run = await getRun(id, authResult.ctx.workspaceId);
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: run });
}
