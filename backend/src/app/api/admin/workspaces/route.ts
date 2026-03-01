import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkspaceUsage } from '@/lib/usage';
import { handleAdminListRequest } from '@/lib/admin-api-helpers';

export async function GET(req: NextRequest) {
    return handleAdminListRequest({
        req,
        resourceName: 'workspaces',
        auditAction: 'admin.workspaces.list',
        fetchItems: (limit, offset) => prisma.workspace.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { members: true, analyses: true, searchHistory: true } },
            },
        }),
        countItems: () => prisma.workspace.count(),
        transform: async (items) => {
            const usageMap = await getWorkspaceUsage(items.map((w) => w.id));
            return items.map((w) => ({ ...w, usage: usageMap.get(w.id) ?? null }));
        },
    });
}
