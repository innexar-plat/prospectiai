import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail, dealSchema } from '@/lib/crm-api';
import { deleteDeal, getDeal, updateDeal } from '@/lib/crm';

type Params = { params: Promise<{ id: string }> };

/** GET /api/crm/deals/[id] — deal with its timeline. */
export async function GET(_req: NextRequest, { params }: Params) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        return NextResponse.json({ deal: await getDeal(ctx.workspaceId, (await params).id) });
    } catch (error) {
        return crmFail(error);
    }
}

/** PATCH /api/crm/deals/[id] */
export async function PATCH(req: NextRequest, { params }: Params) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const input = dealSchema.parse(await req.json().catch(() => ({})));
        return NextResponse.json({ deal: await updateDeal(ctx.workspaceId, (await params).id, input) });
    } catch (error) {
        return crmFail(error);
    }
}

/** DELETE /api/crm/deals/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        await deleteDeal(ctx.workspaceId, (await params).id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return crmFail(error);
    }
}
