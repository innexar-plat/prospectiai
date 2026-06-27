import { NextRequest, NextResponse } from 'next/server';
import { getLead } from '@/modules/auto-prospeccao';
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
  const lead = await getLead(id, authResult.ctx.workspaceId);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: lead });
}
