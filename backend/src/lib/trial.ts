import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/billing-config';
import { logger } from '@/lib/logger';
import { isTrialEnabled, MARKET, type Market } from '@/lib/market';
import { classifyWorkspaceMarket } from '@/lib/admin-market-stats';

/** Trial duration in calendar days for new workspaces. */
export const TRIAL_DAYS = 7;

export const TRIAL_STATUS = 'trialing';
export const TRIAL_EXPIRED_STATUS = 'trial_expired';

export function getTrialEndDate(from = new Date()): Date {
    return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export function buildTrialWorkspaceData(name: string) {
    const trialEnd = getTrialEndDate();
    return {
        name,
        plan: 'TRIAL' as const,
        leadsLimit: PLANS.TRIAL.leadsLimit,
        leadsUsed: 0,
        subscriptionStatus: TRIAL_STATUS,
        currentPeriodEnd: trialEnd,
    };
}

export function buildTrialUserData() {
    return {
        plan: 'TRIAL' as const,
        leadsLimit: PLANS.TRIAL.leadsLimit,
        leadsUsed: 0,
    };
}

type TrialWorkspace = {
    plan?: string | null;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: Date | null;
    leadsLimit?: number | null;
    subscriptionId?: string | null;
    cnpj?: string | null;
    billingCycle?: string | null;
};

function resolveTrialGateMarket(workspace: TrialWorkspace, market?: Market): Market {
    if (market) return market;
    const bucket = classifyWorkspaceMarket({
        plan: workspace.plan ?? 'FREE',
        subscriptionId: workspace.subscriptionId ?? null,
        subscriptionStatus: workspace.subscriptionStatus ?? null,
        leadsLimit: workspace.leadsLimit ?? 0,
        billingCycle: workspace.billingCycle ?? null,
        cnpj: workspace.cnpj ?? null,
    });
    if (bucket === 'US') return 'US';
    return MARKET;
}

export function isTrialExpired(workspace: TrialWorkspace): boolean {
    if (workspace.subscriptionStatus === TRIAL_EXPIRED_STATUS) return true;
    if (workspace.plan !== 'TRIAL') return false;
    if (workspace.currentPeriodEnd && workspace.currentPeriodEnd < new Date()) return true;
    return false;
}

export function isTrialing(workspace: TrialWorkspace): boolean {
    return workspace.plan === 'TRIAL' && workspace.subscriptionStatus === TRIAL_STATUS && !isTrialExpired(workspace);
}

export function getTrialDaysRemaining(workspace: TrialWorkspace): number | null {
    if (workspace.plan !== 'TRIAL' || !workspace.currentPeriodEnd || isTrialExpired(workspace)) return null;
    const ms = workspace.currentPeriodEnd.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Marks workspace as trial_expired when currentPeriodEnd has passed.
 */
export async function applyTrialExpiryIfNeeded(workspaceId: string): Promise<boolean> {
    const w = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, plan: true, subscriptionStatus: true, currentPeriodEnd: true },
    });
    if (!w || w.plan !== 'TRIAL') return false;
    if (w.subscriptionStatus === TRIAL_EXPIRED_STATUS) return false;
    if (!w.currentPeriodEnd || w.currentPeriodEnd >= new Date()) return false;

    await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
            subscriptionStatus: TRIAL_EXPIRED_STATUS,
            starterPromoEligible: true,
        },
    });
    logger.info('Trial expired for workspace', { workspaceId });
    return true;
}

/**
 * Cron job: expire all trials past currentPeriodEnd.
 */
export async function runTrialExpiryJob(): Promise<number> {
    const now = new Date();
    const expired = await prisma.workspace.findMany({
        where: {
            plan: 'TRIAL',
            subscriptionStatus: TRIAL_STATUS,
            currentPeriodEnd: { lt: now },
        },
        select: { id: true },
    });

    if (expired.length === 0) return 0;

    await prisma.workspace.updateMany({
        where: { id: { in: expired.map((w) => w.id) } },
        data: {
            subscriptionStatus: TRIAL_EXPIRED_STATUS,
            starterPromoEligible: true,
        },
    });

    logger.info('Trial expiry cron completed', { count: expired.length });
    return expired.length;
}

const TRIAL_GATE_MESSAGES = {
    US: {
        subscriptionRequired: 'Subscribe to a plan to start prospecting.',
        trialExpired: 'Your trial has ended. Choose a plan to continue.',
    },
    BR: {
        subscriptionRequired: 'Assine um plano para começar a prospectar.',
        trialExpired: 'Seu período de teste encerrou. Escolha um plano para continuar.',
    },
} as const;

export function assertWorkspaceCanUseProduct(
    workspace: TrialWorkspace,
    market?: Market,
): { ok: true } | { ok: false; code: string; message: string } {
    const resolvedMarket = resolveTrialGateMarket(workspace, market);
    const messages = TRIAL_GATE_MESSAGES[resolvedMarket === 'US' ? 'US' : 'BR'];

    if (!isTrialEnabled(resolvedMarket) && workspace.plan === 'FREE' && (workspace.leadsLimit ?? 0) <= 0) {
        return {
            ok: false,
            code: 'SUBSCRIPTION_REQUIRED',
            message: messages.subscriptionRequired,
        };
    }
    if (workspace.plan === 'TRIAL' && isTrialExpired(workspace)) {
        return {
            ok: false,
            code: 'TRIAL_EXPIRED',
            message: messages.trialExpired,
        };
    }
    return { ok: true };
}
