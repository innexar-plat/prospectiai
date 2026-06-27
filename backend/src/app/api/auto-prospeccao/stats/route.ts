import { NextResponse } from 'next/server';
import { getStats } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET() {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const stats = await getStats(authResult.ctx.workspaceId);
  return NextResponse.json({ data: stats });
}
