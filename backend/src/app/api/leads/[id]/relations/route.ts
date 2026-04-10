import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSmartRelations } from '@/lib/smart-relations';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/leads/[id]/relations
 * Returns smart relations (knowledge graph style) for a lead.
 * `id` can be a Lead.id (CUID) or a placeId.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Resolve placeId from id (could be CUID or placeId)
        let placeId = id;
        if (!id.startsWith('ChIJ') && !id.startsWith('Eh') && !id.startsWith('rf_')) {
            const lead = await prisma.lead.findUnique({
                where: { id },
                select: { placeId: true },
            });
            if (lead?.placeId) placeId = lead.placeId;
        }

        const result = await getSmartRelations(placeId, session.user.id);
        return NextResponse.json({ data: result });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
