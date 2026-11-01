import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail } from '@/lib/crm-api';
import { deleteActivity, setActivityDone } from '@/lib/crm';

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/crm/activities/[id] — { done: boolean } */
export async function PATCH(req: NextRequest, { params }: Params) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const body = (await req.json().catch(() => ({}))) as { done?: unknown };
        return NextResponse.json({ activity: await setActivityDone(ctx.workspaceId, (await params).id, body.done === true) });
    } catch (error) {
        return crmFail(error);
    }
}

/** DELETE /api/crm/activities/[id] */
export async function DELETE(_req: NextRequest, { params }: Params) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        await deleteActivity(ctx.workspaceId, (await params).id);
        return NextResponse.json({ ok: true });
    } catch (error) {
        return crmFail(error);
    }
}
