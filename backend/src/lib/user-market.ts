/**
 * Resolve a user's market from their primary OWNER workspace (oldest membership).
 */
import { prisma } from '@/lib/prisma';
import { classifyWorkspaceMarket } from '@/lib/admin-market-stats';
import { MARKET, type Market } from '@/lib/market';

const WORKSPACE_SELECT = {
    plan: true,
    subscriptionId: true,
    subscriptionStatus: true,
    leadsLimit: true,
    billingCycle: true,
    cnpj: true,
} as const;

export async function resolveMarketForWorkspace(workspaceId: string | undefined | null): Promise<Market> {
    if (!workspaceId) return MARKET;
    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: WORKSPACE_SELECT,
    });
    if (!workspace) return MARKET;
    const bucket = classifyWorkspaceMarket(workspace);
    return bucket === 'US' ? 'US' : 'BR';
}

export async function resolveMarketForUser(userId: string): Promise<Market> {
    const membership = await prisma.workspaceMember.findFirst({
        where: { userId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        include: { workspace: { select: WORKSPACE_SELECT } },
    });
    if (!membership) return MARKET;
    const bucket = classifyWorkspaceMarket(membership.workspace);
    return bucket === 'US' ? 'US' : 'BR';
}
