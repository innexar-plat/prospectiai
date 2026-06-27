/**
 * Audience resolution for BR expired-trial reactivation promo emails.
 */

import { prisma } from '@/lib/prisma';
import { classifyWorkspaceMarket } from '@/lib/admin-market-stats';
import { TRIAL_EXPIRED_STATUS, TRIAL_STATUS } from '@/lib/trial';

const PAID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'] as const;
const ACTIVE_PAID_STATUSES = new Set(['active']);

export type ReactivationPromoRecipient = {
  userId: string;
  email: string;
  name: string | null;
  workspaceId: string;
};

type WorkspaceAudienceInput = {
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  subscriptionId: string | null;
  leadsLimit: number;
  billingCycle: string | null;
  cnpj: string | null;
  reactivationPromoSentAt: Date | null;
};

export function hasActivePaidSubscription(workspace: {
  plan: string;
  subscriptionStatus: string | null;
}): boolean {
  return (
    PAID_PLANS.includes(workspace.plan as (typeof PAID_PLANS)[number]) &&
    workspace.subscriptionStatus != null &&
    ACTIVE_PAID_STATUSES.has(workspace.subscriptionStatus)
  );
}

/** Expired trial: TRIAL past end date / trial_expired, or FREE after trial. */
export function isExpiredTrialWorkspace(workspace: WorkspaceAudienceInput): boolean {
  if (hasActivePaidSubscription(workspace)) return false;

  if (workspace.plan === 'TRIAL') {
    if (workspace.subscriptionStatus === TRIAL_EXPIRED_STATUS) return true;
    if (
      workspace.subscriptionStatus === TRIAL_STATUS &&
      workspace.currentPeriodEnd != null &&
      workspace.currentPeriodEnd < new Date()
    ) {
      return true;
    }
    return false;
  }

  if (workspace.plan === 'FREE' && workspace.subscriptionStatus === TRIAL_EXPIRED_STATUS) {
    return true;
  }

  return false;
}

export function isBrMarketWorkspace(workspace: {
  plan: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  leadsLimit: number;
  billingCycle: string | null;
  cnpj: string | null;
}): boolean {
  return classifyWorkspaceMarket(workspace) === 'BR';
}

/**
 * Owners of BR workspaces with expired trial and no active paid subscription.
 * Skips workspaces that already received the reactivation promo email.
 */
export async function findReactivationPromoRecipients(limit?: number): Promise<ReactivationPromoRecipient[]> {
  const now = new Date();

  const memberships = await prisma.workspaceMember.findMany({
    where: {
      role: 'OWNER',
      user: {
        email: { not: null },
        disabledAt: null,
        notifyByEmail: true,
      },
      workspace: {
        reactivationPromoSentAt: null,
        OR: [
          {
            plan: 'TRIAL',
            OR: [
              { subscriptionStatus: TRIAL_EXPIRED_STATUS },
              {
                subscriptionStatus: TRIAL_STATUS,
                currentPeriodEnd: { lt: now },
              },
            ],
          },
          {
            plan: 'FREE',
            subscriptionStatus: TRIAL_EXPIRED_STATUS,
          },
        ],
      },
    },
    select: {
      workspaceId: true,
      user: { select: { id: true, email: true, name: true } },
      workspace: {
        select: {
          plan: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          subscriptionId: true,
          leadsLimit: true,
          billingCycle: true,
          cnpj: true,
          reactivationPromoSentAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const seenEmails = new Set<string>();
  const recipients: ReactivationPromoRecipient[] = [];

  const unsubscribedRows =
    memberships.length > 0
      ? await prisma.emailUnsubscribe.findMany({
          where: {
            email: {
              in: memberships
                .map((row) => row.user.email?.trim().toLowerCase())
                .filter((email): email is string => Boolean(email)),
            },
            category: { in: ['ALL', 'MARKETING', 'PROMOTIONS'] },
          },
          select: { email: true },
        })
      : [];
  const unsubscribedEmails = new Set(unsubscribedRows.map((row) => row.email.toLowerCase()));

  for (const row of memberships) {
    const email = row.user.email?.trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    if (unsubscribedEmails.has(email)) continue;

    if (!isExpiredTrialWorkspace(row.workspace)) continue;
    if (!isBrMarketWorkspace(row.workspace)) continue;

    seenEmails.add(email);
    recipients.push({
      userId: row.user.id,
      email: row.user.email!,
      name: row.user.name,
      workspaceId: row.workspaceId,
    });

    if (limit != null && recipients.length >= limit) break;
  }

  return recipients;
}
