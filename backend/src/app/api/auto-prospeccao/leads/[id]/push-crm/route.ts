import { NextRequest, NextResponse } from 'next/server';
import { pushSingleLeadToCrm } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../../../_helpers';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { id } = await params;

  try {
    const result = await pushSingleLeadToCrm(id, authResult.ctx.workspaceId);
    return NextResponse.json({ data: result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'CRM push failed';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
