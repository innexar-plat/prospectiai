import { NextRequest, NextResponse } from 'next/server';
import { discardLead } from '@/modules/auto-prospeccao';
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
    await discardLead(id, authResult.ctx.workspaceId);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
