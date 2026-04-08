import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getBatchJob } from '@/modules/analyze/application/batch-jobs';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const job = getBatchJob(id, session.user.id);
        if (!job) {
            return NextResponse.json({ error: 'Batch job not found' }, { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Analyze batch status error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
