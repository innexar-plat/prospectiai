import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail } from '@/lib/crm-api';
import { getBoard } from '@/lib/crm';

/** GET /api/crm/board?pipelineId=&owner=&q= — kanban columns, cards and forecast metrics. */
export async function GET(req: NextRequest) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    const sp = req.nextUrl.searchParams;
    try {
        return NextResponse.json(await getBoard(ctx.workspaceId, { pipelineId: sp.get('pipelineId'), ownerUserId: sp.get('owner'), q: sp.get('q') }));
    } catch (error) {
        return crmFail(error);
    }
}
