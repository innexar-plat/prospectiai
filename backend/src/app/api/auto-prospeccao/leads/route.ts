import { NextRequest, NextResponse } from 'next/server';
import { listLeads } from '@/modules/auto-prospeccao';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET(req: NextRequest) {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const status = searchParams.get('status') ?? undefined;
  const uf = searchParams.get('uf') ?? undefined;
  const dateFrom = searchParams.get('dateFrom') ?? undefined;
  const dateTo = searchParams.get('dateTo') ?? undefined;
  const minScore = searchParams.has('minScore')
    ? parseInt(searchParams.get('minScore')!, 10)
    : undefined;
  const maxScore = searchParams.has('maxScore')
    ? parseInt(searchParams.get('maxScore')!, 10)
    : undefined;

  const result = await listLeads(authResult.ctx.workspaceId, {
    status,
    uf,
    dateFrom,
    dateTo,
    minScore,
    maxScore,
    page,
    limit,
  });

  return NextResponse.json(result);
}
