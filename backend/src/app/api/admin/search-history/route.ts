import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleAdminListRequest } from '@/lib/admin-api-helpers';

export async function GET(req: NextRequest) {
    return handleAdminListRequest({
        req,
        resourceName: 'search-history',
        auditAction: 'admin.search-history.list',
        parseQuery: (req) => ({
            workspaceId: req.nextUrl.searchParams.get('workspaceId') ?? undefined,
        }),
        fetchItems: (limit, offset, query) => prisma.searchHistory.findMany({
            where: query.workspaceId ? { workspaceId: query.workspaceId } : {},
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { id: true, name: true, email: true } },
                workspace: { select: { id: true, name: true } },
            },
        }),
        countItems: (query) => prisma.searchHistory.count({
            where: query.workspaceId ? { workspaceId: query.workspaceId } : {},
        }),
    });
}
