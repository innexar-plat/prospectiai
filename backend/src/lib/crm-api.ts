import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getApiSession } from '@/lib/api-auth';
import { CrmError, resolveCrmWorkspace } from '@/lib/crm';

/** Session + workspace for CRM routes; returns a response on failure. */
export async function crmContext(): Promise<{ userId: string; workspaceId: string } | NextResponse> {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        return { userId: session.user.id, workspaceId: await resolveCrmWorkspace(session.user.id) };
    } catch (error) {
        return crmFail(error);
    }
}

export function crmFail(error: unknown) {
    if (error instanceof CrmError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const dealSchema = z.object({
    title: z.string().trim().max(160).optional(),
    value: z.number().min(0).max(1e12).optional(),
    stageId: z.string().max(40).optional(),
    pipelineId: z.string().max(40).optional(),
    expectedCloseAt: z.iso.datetime({ offset: true }).or(z.iso.date()).nullable().optional(),
    ownerUserId: z.string().max(40).nullable().optional(),
    companyName: optionalText(200),
    contactName: optionalText(160),
    contactPhone: optionalText(40),
    contactEmail: optionalText(200),
    leadAnalysisId: z.string().max(40).nullable().optional(),
});

export const moveSchema = z.object({
    stageId: z.string().min(1).max(40),
    position: z.number().finite(),
    lostReason: optionalText(300),
});

export const activitySchema = z.object({
    type: z.enum(['NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK']),
    title: optionalText(200),
    body: optionalText(5000),
    dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
    done: z.boolean().optional(),
});

export const stagesSchema = z.object({
    stages: z.array(z.object({
        id: z.string().max(40).optional(),
        name: z.string().trim().min(1).max(60),
        probability: z.number().min(0).max(100),
        kind: z.enum(['OPEN', 'WON', 'LOST']),
        color: z.string().max(20).optional(),
    })).min(3).max(20),
});
