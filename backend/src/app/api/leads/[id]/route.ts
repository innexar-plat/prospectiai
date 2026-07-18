import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { leadStatusSchema, formatZodError } from '@/lib/validations/schemas';
import { recordLeadEvent } from '@/lib/lead-intelligence';

async function findLeadAnalysisForUser(analysisId: string, userId: string) {
    const userWithWorkspace = await prisma.user.findUnique({
        where: { id: userId },
        include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } },
    });
    const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;
    const where = workspaceId
        ? { id: analysisId, workspaceId }
        : { id: analysisId, userId };
    return prisma.leadAnalysis.findFirst({
        where,
        include: { lead: true },
    });
}

/** GET /api/leads/[id] — single LeadAnalysis with included lead (workspace-scoped when applicable). */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getApiSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!id?.trim()) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        const analysis = await findLeadAnalysisForUser(id, session.user.id);
        if (!analysis) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        return NextResponse.json(analysis);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error fetching lead', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getApiSession();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const parsed = leadStatusSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { status, isFavorite, conversionReason, dealValue, lostReason } = parsed.data;

        const current = await findLeadAnalysisForUser(id, session.user.id);
        if (!current) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Build update data
        const data: Record<string, unknown> = {};
        if (status !== undefined) data.status = status;
        if (isFavorite !== undefined) data.isFavorite = isFavorite;
        if (conversionReason !== undefined) data.conversionReason = conversionReason;
        if (dealValue !== undefined) data.dealValue = dealValue;
        if (lostReason !== undefined) data.lostReason = lostReason;

        // Set timestamps based on status change
        if (status === 'CONTACTED' && current.status !== 'CONTACTED') data.contactedAt = new Date();
        if (status === 'CONVERTED' && current.status !== 'CONVERTED') data.convertedAt = new Date();
        if (status === 'LOST' && current.status !== 'LOST') data.lostAt = new Date();

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } },
        });
        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;
        const updateWhere = workspaceId
            ? { id, workspaceId }
            : { id, userId: session.user.id };

        const updated = await prisma.leadAnalysis.update({
            where: updateWhere,
            data,
        });

        // Record event + invalidate pipeline cache on status change
        if (status !== undefined && status !== current.status) {
            const eventType = status === 'CONVERTED' ? 'CONVERTED'
                : status === 'LOST' ? 'LOST'
                : status === 'CONTACTED' ? 'CONTACTED'
                : 'STATUS_CHANGE';

            recordLeadEvent({
                leadId: current.leadId,
                userId: session.user.id,
                workspaceId: current.workspaceId,
                type: eventType,
                oldValue: current.status,
                newValue: status,
                metadata: {
                    analysisId: id,
                    ...(conversionReason && { reason: conversionReason }),
                    ...(dealValue != null && { dealValue }),
                    ...(lostReason && { lostReason }),
                },
            });

            // Invalidate today's PipelineBrief cache so next load reflects the change
            if (current.workspaceId) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                prisma.pipelineBrief.deleteMany({
                    where: { workspaceId: current.workspaceId, briefDate: today },
                }).catch(() => {}); // fire-and-forget
            }
        }

        return NextResponse.json(updated);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error updating lead status', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
