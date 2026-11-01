import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail, dealSchema } from '@/lib/crm-api';
import { createDeal } from '@/lib/crm';

/** POST /api/crm/deals — new deal (optionally from a saved Precision lead). */
export async function POST(req: NextRequest) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const input = dealSchema.parse(await req.json().catch(() => ({})));
        return NextResponse.json({ deal: await createDeal(ctx.workspaceId, ctx.userId, input) }, { status: 201 });
    } catch (error) {
        return crmFail(error);
    }
}
