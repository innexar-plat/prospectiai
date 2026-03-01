import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';
import { applyGracePeriodExpiryIfNeeded } from '@/lib/grace-period';

function buildWorkspaceProfile(w: { companyName?: string | null; productService?: string | null; targetAudience?: string | null; mainBenefit?: string | null; address?: string | null; linkedInUrl?: string | null; instagramUrl?: string | null; facebookUrl?: string | null; websiteUrl?: string | null; logoUrl?: string | null } | null) {
    if (!w) return null;
    return {
        companyName: w.companyName ?? null,
        productService: w.productService ?? null,
        targetAudience: w.targetAudience ?? null,
        mainBenefit: w.mainBenefit ?? null,
        address: w.address ?? null,
        linkedInUrl: w.linkedInUrl ?? null,
        instagramUrl: w.instagramUrl ?? null,
        facebookUrl: w.facebookUrl ?? null,
        websiteUrl: w.websiteUrl ?? null,
        logoUrl: w.logoUrl ?? null,
    };
}

const userMeSelect = {
    id: true,
    name: true,
    email: true,
    image: true,
    plan: true,
    leadsUsed: true,
    leadsLimit: true,
    companyName: true,
    productService: true,
    targetAudience: true,
    mainBenefit: true,
    phone: true,
    address: true,
    linkedInUrl: true,
    instagramUrl: true,
    facebookUrl: true,
    websiteUrl: true,
    onboardingCompletedAt: true,
    notifyByEmail: true,
    notifyWeeklyReport: true,
    notifyLeadAlerts: true,
    workspaces: { include: { workspace: true }, take: 1 },
} as const;

/** Garante que o usuário tenha ao menos um workspace (OAuth e outros fluxos podem criar user sem workspace). */
async function ensureUserHasWorkspace(userId: string, userName: string | null): Promise<void> {
    const existing = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { id: true },
    });
    if (existing) return;
    const workspaceName = (userName && userName.trim()) ? `${userName.trim()} - Workspace` : 'Meu Workspace';
    await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
            data: { name: workspaceName, plan: 'FREE', leadsLimit: 10, leadsUsed: 0 },
        });
        await tx.workspaceMember.create({
            data: { userId, workspaceId: workspace.id, role: 'OWNER' },
        });
        logger.info('Workspace created for user without workspace', { userId, workspaceId: workspace.id });
    });
}

async function fetchUserWithWorkspace(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: userMeSelect,
    });
    if (!user) return null;
    if (user.workspaces.length === 0) {
        await ensureUserHasWorkspace(user.id, user.name);
        return prisma.user.findUnique({
            where: { id: userId },
            select: userMeSelect,
        });
    }
    return user;
}

type WorkspaceAfterExpiry = {
    plan?: string | null;
    leadsUsed?: number | null;
    leadsLimit?: number | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: Date | null;
    gracePeriodEnd?: Date | null;
    pendingPlanId?: string | null;
    pendingPlanEffectiveAt?: Date | null;
    companyName?: string | null;
    productService?: string | null;
    targetAudience?: string | null;
    mainBenefit?: string | null;
    address?: string | null;
    linkedInUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    logoUrl?: string | null;
};

function buildUiUser(
    user: { workspaces?: Array<{ workspace?: WorkspaceAfterExpiry | null }>; [k: string]: unknown },
    w: WorkspaceAfterExpiry | null | undefined,
): Record<string, unknown> {
    return {
        ...user,
        companyName: w?.companyName ?? user.companyName ?? null,
        productService: w?.productService ?? user.productService ?? null,
        targetAudience: w?.targetAudience ?? user.targetAudience ?? null,
        mainBenefit: w?.mainBenefit ?? user.mainBenefit ?? null,
        plan: w?.plan || user.plan || 'FREE',
        leadsUsed: w?.leadsUsed ?? user.leadsUsed ?? 0,
        leadsLimit: w?.leadsLimit ?? user.leadsLimit ?? 10,
        subscriptionStatus: w?.subscriptionStatus ?? null,
        currentPeriodEnd: w?.currentPeriodEnd?.toISOString() ?? null,
        gracePeriodEnd: w?.gracePeriodEnd?.toISOString() ?? null,
        pendingPlanId: w?.pendingPlanId ?? null,
        pendingPlanEffectiveAt: w?.pendingPlanEffectiveAt?.toISOString() ?? null,
        workspaces: undefined,
        requiresOnboarding: user.onboardingCompletedAt == null,
        notifyByEmail: user.notifyByEmail,
        notifyWeeklyReport: user.notifyWeeklyReport,
        notifyLeadAlerts: user.notifyLeadAlerts,
    };
}

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ user: null }, { requestId });
        }
        const user = await fetchUserWithWorkspace(session.user.id);
        if (!user) {
            return jsonWithRequestId({ error: 'User not found' }, { status: 404, requestId });
        }
        const activeWorkspace = user.workspaces?.[0]?.workspace as WorkspaceAfterExpiry & { id?: string } | undefined;
        if (activeWorkspace?.id) {
            await applyGracePeriodExpiryIfNeeded(activeWorkspace.id);
        }
        const workspaceAfterExpiry = activeWorkspace?.id
            ? await prisma.workspace.findUnique({
                where: { id: activeWorkspace.id },
                select: {
                    plan: true,
                    leadsUsed: true,
                    leadsLimit: true,
                    subscriptionStatus: true,
                    currentPeriodEnd: true,
                    gracePeriodEnd: true,
                    pendingPlanId: true,
                    pendingPlanEffectiveAt: true,
                    companyName: true,
                    productService: true,
                    targetAudience: true,
                    mainBenefit: true,
                    address: true,
                    linkedInUrl: true,
                    instagramUrl: true,
                    facebookUrl: true,
                    websiteUrl: true,
                    logoUrl: true,
                },
            })
            : null;
        const w = workspaceAfterExpiry ?? activeWorkspace ?? null;
        const workspaceProfile = buildWorkspaceProfile(w);
        const uiUser = buildUiUser(user, w);
        return jsonWithRequestId({ user: uiUser, workspaceProfile }, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('User me error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
