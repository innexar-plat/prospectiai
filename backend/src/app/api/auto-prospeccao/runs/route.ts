import { NextRequest, NextResponse } from 'next/server';
import { listRuns } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET(req: NextRequest) {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const result = await listRuns(authResult.ctx.workspaceId, page, limit);
  return NextResponse.json(result);
}
