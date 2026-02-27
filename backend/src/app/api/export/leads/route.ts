import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { exportLeadsQuerySchema, formatZodError } from '@/lib/validations/schemas';

/**
 * GET /api/export/leads?format=json|csv
 * Exporta análises de leads do workspace do usuário em JSON ou CSV. Autenticado.
 */
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const parsed = exportLeadsQuerySchema.safeParse({
            format: req.nextUrl.searchParams.get('format') ?? undefined,
        });
        if (!parsed.success) {
            return jsonWithRequestId({ error: formatZodError(parsed) }, { status: 400, requestId });
        }
        const format = parsed.data.format ?? 'json';

        const userWithWorkspace = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { workspaces: { take: 1 } },
        });

        const workspaceId = userWithWorkspace?.workspaces[0]?.workspaceId;
        const filter = workspaceId ? { workspaceId } : { userId: session.user.id };

        const analyses = await prisma.leadAnalysis.findMany({
            where: filter,
            include: { lead: true },
            orderBy: { createdAt: 'desc' },
        });

        if (format === 'csv') {
            const header = 'leadId,leadName,score,scoreLabel,status,summary,createdAt';
            const rows = analyses.map((a) => {
                const name = (a.lead?.name ?? '').replace(/"/g, '""');
                const summary = (a.summary ?? '').replace(/"/g, '""').replace(/\n/g, ' ');
                return `${a.leadId},"${name}",${a.score ?? ''},${a.scoreLabel ?? ''},${a.status},${summary},${a.createdAt.toISOString()}`;
            });
            const csv = [header, ...rows].join('\n');
            const res = new Response(csv, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="leads-export.csv"',
                    'x-request-id': requestId,
                },
            });
            return res;
        }

        return jsonWithRequestId(analyses, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Export leads error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
