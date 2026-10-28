import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getFollowUpMessage } from '@/lib/follow-up-message';
import { rateLimit } from '@/lib/ratelimit';

/**
 * POST /api/leads/[id]/follow-up-message — next cadence message (2nd, 3rd, breakup) for a
 * contacted lead. Generated once per touch and cached; no credit is charged.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getApiSession();
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const limited = await rateLimit(`follow-up-msg:${session.user.id}`, 30, 60 * 60);
        if (!limited.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

        const { id } = await params;
        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            orderBy: { workspace: { createdAt: 'asc' } },
            select: { workspaceId: true, user: { select: { market: true } } },
        });
        const en = req.nextUrl.searchParams.get('locale') === 'en' || membership?.user.market === 'US';
        const result = await getFollowUpMessage(id, { userId: session.user.id, workspaceId: membership?.workspaceId }, en);
        if (!result) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        return NextResponse.json(result);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Follow-up message failed', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
