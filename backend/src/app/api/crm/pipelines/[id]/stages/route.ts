import { NextRequest, NextResponse } from 'next/server';
import { crmContext, crmFail, stagesSchema } from '@/lib/crm-api';
import { saveStages } from '@/lib/crm';

/** PUT /api/crm/pipelines/[id]/stages — rename, reorder, add and remove stages. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await crmContext();
    if (ctx instanceof NextResponse) return ctx;
    try {
        const input = stagesSchema.parse(await req.json().catch(() => ({})));
        return NextResponse.json({ stages: await saveStages(ctx.workspaceId, (await params).id, input.stages) });
    } catch (error) {
        return crmFail(error);
    }
}
