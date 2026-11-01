import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail, activitySchema } from '@/lib/crm-api';
import { addActivity } from '@/lib/crm';

/** POST /api/crm/deals/[id]/activities — note, logged call/message, meeting or task. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const input = activitySchema.parse(await req.json().catch(() => ({})));
        return NextResponse.json({ activity: await addActivity(ctx.workspaceId, ctx.userId, (await params).id, input) }, { status: 201 });
    } catch (error) {
        return crmFail(error);
    }
}
