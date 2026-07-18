import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { saveLeadSchema, formatZodError } from '@/lib/validations/schemas';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } }
        });

        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;

        // If no workspace yet (should not happen after migration), fallback to their personal userId
        const filter = workspaceId ? { workspaceId } : { userId: session.user.id };

        const analyses = await prisma.leadAnalysis.findMany({
            where: filter,
            include: { lead: true },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(analyses);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error fetching leads', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/leads — Save a lead without running AI analysis.
 * Creates/upserts the Lead record and a LeadAnalysis bookmark (no score, no AI data).
 * Returns the created/existing LeadAnalysis item.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const parsed = saveLeadSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { placeId, name, address, phone, website, rating, reviewCount, types, businessStatus } = parsed.data;

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } }
        });
        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;

        // Upsert the Lead record
        const lead = await prisma.lead.upsert({
            where: { placeId },
            update: {
                name,
                ...(address !== undefined && { address }),
                ...(phone !== undefined && { phone }),
                ...(website !== undefined && { website }),
                ...(rating !== undefined && { rating }),
                ...(reviewCount !== undefined && { reviewCount }),
                ...(types !== undefined && { types }),
                ...(businessStatus !== undefined && { businessStatus }),
                lastSearchedAt: new Date(),
            },
            create: {
                placeId,
                name,
                address,
                phone,
                website,
                rating,
                reviewCount,
                types,
                businessStatus,
            },
        });

        // Check if a LeadAnalysis already exists for this user/workspace + lead
        const filter = workspaceId
            ? { leadId: lead.id, workspaceId }
            : { leadId: lead.id, userId: session.user.id };

        const existing = await prisma.leadAnalysis.findFirst({ where: filter });
        if (existing) {
            const withLead = await prisma.leadAnalysis.findUnique({ where: { id: existing.id }, include: { lead: true } });
            return NextResponse.json(withLead);
        }

        const analysis = await prisma.leadAnalysis.create({
            data: {
                userId: session.user.id,
                leadId: lead.id,
                workspaceId: workspaceId ?? null,
                isFavorite: true,
            },
            include: { lead: true },
        });

        // Invalidate PipelineBrief cache so new lead appears
        if (workspaceId) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            prisma.pipelineBrief.deleteMany({
                where: { workspaceId, briefDate: today },
            }).catch(() => {});
        }

        return NextResponse.json(analysis, { status: 201 });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error saving lead', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
