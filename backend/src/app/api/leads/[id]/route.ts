import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { leadStatusSchema, formatZodError } from '@/lib/validations/schemas';

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
        const { status, isFavorite } = parsed.data;

        const data: { status?: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST'; isFavorite?: boolean } = {};
        if (status !== undefined) data.status = status;
        if (isFavorite !== undefined) data.isFavorite = isFavorite;

        const updated = await prisma.leadAnalysis.update({
            where: {
                id,
                userId: session.user.id // Security check
            },
            data,
        });

        return NextResponse.json(updated);
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error updating lead status', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
