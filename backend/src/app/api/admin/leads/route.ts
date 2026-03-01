import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleAdminListRequest } from '@/lib/admin-api-helpers';

export async function GET(req: NextRequest) {
    return handleAdminListRequest({
        req,
        resourceName: 'leads',
        auditAction: 'admin.leads.list',
        parseQuery: (req) => ({
            workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
        }),
        fetchItems: (limit, offset, query) => prisma.leadAnalysis.findMany({
            where: query.workspaceId ? { workspaceId: query.workspaceId } : {},
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } },
                workspace: { select: { id: true, name: true } },
                lead: true,
            },
        }),
        countItems: (query) => prisma.leadAnalysis.count({
            where: query.workspaceId ? { workspaceId: query.workspaceId } : {},
        }),
    });
}
