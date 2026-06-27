import { NextRequest, NextResponse } from 'next/server';
import { toggleProfile } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../../../_helpers';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { id } = await params;
  const profile = await toggleProfile(id, authResult.ctx.workspaceId);
  return NextResponse.json({ data: profile });
}
