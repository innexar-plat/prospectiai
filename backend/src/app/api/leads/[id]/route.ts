import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { leadStatusSchema, formatZodError } from '@/lib/validations/schemas';
import { recordLeadEvent } from '@/lib/lead-intelligence';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
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

        // Get current state for event tracking
        const current = await prisma.leadAnalysis.findUnique({
            where: { id, userId: session.user.id },
            select: { status: true, leadId: true, workspaceId: true },
        });
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

        const updated = await prisma.leadAnalysis.update({
            where: { id, userId: session.user.id },
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
