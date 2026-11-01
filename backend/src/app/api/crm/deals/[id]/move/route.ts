import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail, moveSchema } from '@/lib/crm-api';
import { moveDeal } from '@/lib/crm';

/** POST /api/crm/deals/[id]/move — drag & drop between stages ({ stageId, position, lostReason? }). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const input = moveSchema.parse(await req.json().catch(() => ({})));
        return NextResponse.json({ deal: await moveDeal(ctx.workspaceId, ctx.userId, (await params).id, input.stageId, input.position, input.lostReason) });
    } catch (error) {
        return crmFail(error);
    }
}
