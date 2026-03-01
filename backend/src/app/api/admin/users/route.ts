import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleAdminListRequest } from '@/lib/admin-api-helpers';

export async function GET(req: NextRequest) {
    return handleAdminListRequest({
        req,
        resourceName: 'users',
        auditAction: 'admin.users.list',
        fetchItems: (limit, offset) => prisma.user.findMany({
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                plan: true,
                disabledAt: true,
                onboardingCompletedAt: true,
                createdAt: true,
                _count: { select: { workspaces: true, analyses: true, searchHistory: true } },
            },
        }),
        countItems: () => prisma.user.count(),
    });
}
