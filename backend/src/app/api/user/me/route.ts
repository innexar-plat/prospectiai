import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';
import { applyGracePeriodExpiryIfNeeded } from '@/lib/grace-period';
import { applyTrialExpiryIfNeeded, getTrialDaysRemaining, isTrialExpired, isTrialing } from '@/lib/trial';
import { buildRegistrationWorkspaceData } from '@/lib/registration';
import { getRequestMarket } from '@/lib/market';
import { canApplyStarterPromo, getStarterPromoPublicInfo } from '@/lib/billing-promo';

function buildWorkspaceProfile(w: { companyName?: string | null; legalName?: string | null; tradeName?: string | null; cnpj?: string | null; primaryCnaeCode?: string | null; primaryCnaeDescription?: string | null; companySize?: string | null; foundingDate?: string | null; productService?: string | null; targetAudience?: string | null; mainBenefit?: string | null; address?: string | null; postalCode?: string | null; street?: string | null; number?: string | null; complement?: string | null; neighborhood?: string | null; city?: string | null; state?: string | null; linkedInUrl?: string | null; instagramUrl?: string | null; facebookUrl?: string | null; websiteUrl?: string | null; logoUrl?: string | null; serviceModel?: string | null; averageTicket?: number | null; operationRadiusKm?: number | null; knownCompetitors?: string | null } | null) {
    if (!w) return null;
    return {
        companyName: w.companyName ?? null,
        legalName: w.legalName ?? null,
        tradeName: w.tradeName ?? null,
        cnpj: w.cnpj ?? null,
        primaryCnaeCode: w.primaryCnaeCode ?? null,
        primaryCnaeDescription: w.primaryCnaeDescription ?? null,
        companySize: w.companySize ?? null,
        foundingDate: w.foundingDate ?? null,
        productService: w.productService ?? null,
        targetAudience: w.targetAudience ?? null,
        mainBenefit: w.mainBenefit ?? null,
        address: w.address ?? null,
        postalCode: w.postalCode ?? null,
        street: w.street ?? null,
        number: w.number ?? null,
        complement: w.complement ?? null,
        neighborhood: w.neighborhood ?? null,
        city: w.city ?? null,
        state: w.state ?? null,
        linkedInUrl: w.linkedInUrl ?? null,
        instagramUrl: w.instagramUrl ?? null,
        facebookUrl: w.facebookUrl ?? null,
        websiteUrl: w.websiteUrl ?? null,
        logoUrl: w.logoUrl ?? null,
        serviceModel: w.serviceModel ?? null,
        averageTicket: w.averageTicket ?? null,
        operationRadiusKm: w.operationRadiusKm ?? null,
        knownCompetitors: w.knownCompetitors ?? null,
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
    emailVerified: true,
    notifyByEmail: true,
    workspaces: { include: { workspace: true }, orderBy: { workspace: { createdAt: 'asc' } }, take: 1 },
} as const;

/** Garante que o usuário tenha ao menos um workspace (OAuth e outros fluxos podem criar user sem workspace). */
async function ensureUserHasWorkspace(userId: string, userName: string | null, market = getRequestMarket(new Request('http://localhost'))): Promise<void> {
    const existing = await prisma.workspaceMember.findFirst({
        where: { userId },
        select: { id: true },
    });
    if (existing) return;
    const workspaceName = (userName && userName.trim()) ? `${userName.trim()} - Workspace` : 'Meu Workspace';
    await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
            data: buildRegistrationWorkspaceData(workspaceName, market),
        });
        await tx.workspaceMember.create({
            data: { userId, workspaceId: workspace.id, role: 'OWNER' },
        });
        logger.info('Workspace created for user without workspace', { userId, workspaceId: workspace.id });
    });
}

async function fetchUserWithWorkspace(userId: string, market = getRequestMarket(new Request('http://localhost'))) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: userMeSelect,
    });
    if (!user) return null;
    if (user.workspaces.length === 0) {
        await ensureUserHasWorkspace(user.id, user.name, market);
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
    billingCycle?: string | null;
    gracePeriodEnd?: Date | null;
    pendingPlanId?: string | null;
    pendingPlanEffectiveAt?: Date | null;
    starterPromoEligible?: boolean | null;
    companyName?: string | null;
    legalName?: string | null;
    tradeName?: string | null;
    cnpj?: string | null;
    primaryCnaeCode?: string | null;
    primaryCnaeDescription?: string | null;
    companySize?: string | null;
    foundingDate?: string | null;
    productService?: string | null;
    targetAudience?: string | null;
    mainBenefit?: string | null;
    address?: string | null;
    postalCode?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    linkedInUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    logoUrl?: string | null;
    serviceModel?: string | null;
    averageTicket?: number | null;
    operationRadiusKm?: number | null;
    knownCompetitors?: string | null;
    autoProspeccaoEnabled?: boolean | null;
};

function buildUiUser(
    user: { workspaces?: Array<{ workspace?: WorkspaceAfterExpiry | null }>; [k: string]: unknown },
    w: WorkspaceAfterExpiry | null | undefined,
    market: ReturnType<typeof getRequestMarket>,
    isRepresentative = false,
): Record<string, unknown> {
    const promoEligible = w ? canApplyStarterPromo(w, market, 'monthly') : false;
    const starterPromo = market === 'BR' ? getStarterPromoPublicInfo(promoEligible) : null;
    return {
        ...user,
        companyName: w?.companyName ?? user.companyName ?? null,
        legalName: w?.legalName ?? null,
        tradeName: w?.tradeName ?? null,
        cnpj: w?.cnpj ?? null,
        primaryCnaeCode: w?.primaryCnaeCode ?? null,
        primaryCnaeDescription: w?.primaryCnaeDescription ?? null,
        companySize: w?.companySize ?? null,
        foundingDate: w?.foundingDate ?? null,
        productService: w?.productService ?? user.productService ?? null,
        targetAudience: w?.targetAudience ?? user.targetAudience ?? null,
        mainBenefit: w?.mainBenefit ?? user.mainBenefit ?? null,
        postalCode: w?.postalCode ?? null,
        street: w?.street ?? null,
        number: w?.number ?? null,
        complement: w?.complement ?? null,
        neighborhood: w?.neighborhood ?? null,
        city: w?.city ?? null,
        state: w?.state ?? null,
        serviceModel: w?.serviceModel ?? null,
        averageTicket: w?.averageTicket ?? null,
        operationRadiusKm: w?.operationRadiusKm ?? null,
        knownCompetitors: w?.knownCompetitors ?? null,
        plan: w?.plan || user.plan || 'FREE',
        leadsUsed: w?.leadsUsed ?? user.leadsUsed ?? 0,
        leadsLimit: w?.leadsLimit ?? user.leadsLimit ?? 10,
        subscriptionStatus: w?.subscriptionStatus ?? null,
        currentPeriodEnd: w?.currentPeriodEnd?.toISOString() ?? null,
        billingCycle: w?.billingCycle ?? null,
        gracePeriodEnd: w?.gracePeriodEnd?.toISOString() ?? null,
        pendingPlanId: w?.pendingPlanId ?? null,
        pendingPlanEffectiveAt: w?.pendingPlanEffectiveAt?.toISOString() ?? null,
        autoProspeccaoEnabled: w?.autoProspeccaoEnabled ?? false,
        isTrialing: isTrialing(w ?? {}),
        trialExpired: isTrialExpired(w ?? {}),
        trialDaysRemaining: getTrialDaysRemaining(w ?? {}),
        starterPromoEligible: promoEligible,
        starterPromo,
        workspaces: undefined,
        requiresOnboarding: user.onboardingCompletedAt == null && !isRepresentative,
        emailVerified: user.emailVerified != null,
        notifyByEmail: user.notifyByEmail,
        isRepresentative,
    };
}

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ user: null }, { requestId });
        }
        const user = await fetchUserWithWorkspace(session.user.id, getRequestMarket(req));
        if (!user) {
            return jsonWithRequestId({ error: 'User not found' }, { status: 404, requestId });
        }
        const activeWorkspace = user.workspaces?.[0]?.workspace as WorkspaceAfterExpiry & { id?: string } | undefined;
        if (activeWorkspace?.id) {
            await applyGracePeriodExpiryIfNeeded(activeWorkspace.id);
            await applyTrialExpiryIfNeeded(activeWorkspace.id);
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
                    starterPromoEligible: true,
                    companyName: true,
                    legalName: true,
                    tradeName: true,
                    cnpj: true,
                    primaryCnaeCode: true,
                    primaryCnaeDescription: true,
                    companySize: true,
                    foundingDate: true,
                    productService: true,
                    targetAudience: true,
                    mainBenefit: true,
                    address: true,
                    postalCode: true,
                    street: true,
                    number: true,
                    complement: true,
                    neighborhood: true,
                    city: true,
                    state: true,
                    linkedInUrl: true,
                    instagramUrl: true,
                    facebookUrl: true,
                    websiteUrl: true,
                    logoUrl: true,
                    serviceModel: true,
                    averageTicket: true,
                    operationRadiusKm: true,
                    knownCompetitors: true,
                    autoProspeccaoEnabled: true,
                },
            })
            : null;
        const w = workspaceAfterExpiry ?? activeWorkspace ?? null;
        const workspaceProfile = buildWorkspaceProfile(w);
        const market = getRequestMarket(req);
        const representative = await prisma.representative.findUnique({
            where: { userId: session.user.id },
            select: { status: true },
        });
        const isRepresentative = representative?.status === 'ACTIVE';
        const uiUser = buildUiUser(user, w, market, isRepresentative);
        return jsonWithRequestId({ user: uiUser, workspaceProfile }, { requestId });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('User me error', { error: error instanceof Error ? error.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
