/**
 * Daily billing lifecycle job. Order matters:
 *  1. trials        — expire ended trials, warn the day before
 *  2. grace         — past_due workspaces whose grace ended go to FREE
 *  3. pending plans — scheduled downgrades/cancellations at period end
 *  4. credits       — monthly cycle: unused credits expire, leadsUsed resets
 *  5. notices       — "your credits expire in N days"
 *  6. PIX renewals  — recurring PIX: generate the next cycle's charge before period end
 *  7. expiry        — paid period over (+ grace) and no renewal: reconcile with the
 *                     provider, then move to FREE
 *
 * Every step is idempotent; dryRun reports what would change without writing,
 * charging or emailing. Manual/admin plan grants (no subscriptionId) are never
 * expired or downgraded here.
 */
import type { Workspace } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { PLANS, type PlanType } from '@/lib/billing-config';
import { getMarketPlanPrices } from '@/lib/billing-prices';
import { STARTER_PROMO_BR } from '@/lib/billing-promo';
import { getMarketLeadsLimit, type Market } from '@/lib/market';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { cancelPreApproval, getPreApproval, updatePreApprovalAmount } from '@/lib/mercadopago-subscription';
import { createPixRenewalCharge } from '@/lib/mercadopago-pix';
import { TRIAL_EXPIRED_STATUS, TRIAL_STATUS } from '@/lib/trial';
import {
    addDays,
    CREDITS_EXPIRING_NOTICE_DAYS,
    freshCreditCycle,
    isMpOneTimeId,
    isMpPreapprovalId,
    isStripeSubscriptionId,
    nextCreditsResetAt,
    PERIOD_GRACE_DAYS,
    PIX_RENEWAL_LEAD_DAYS,
    toCycle,
    UNLIMITED_LEADS_THRESHOLD,
} from '@/lib/billing-period';
import {
    sendCreditsExpiringEmail,
    sendGraceExpiredEmail,
    sendPixRenewalEmail,
    sendPlanChangedEmail,
    sendPlanExpiredEmail,
    sendTrialExpiredEmail,
    sendTrialExpiringEmail,
    type BillingRecipient,
    type ReactivationPix,
} from '@/lib/billing-emails';
import { logger } from '@/lib/logger';

const PAID_PLANS: PlanType[] = ['BASIC', 'PRO', 'BUSINESS', 'SCALE'];
/** Remaining credits below this share of the limit are not worth an "expiring" email. */
const CREDITS_NOTICE_MIN_SHARE = 0.2;

export interface LifecycleAction {
    step: string;
    workspaceId: string;
    detail: string;
}

export interface LifecycleReport {
    dryRun: boolean;
    actions: LifecycleAction[];
    errors: LifecycleAction[];
    counts: Record<string, number>;
}

interface Ctx {
    now: Date;
    dryRun: boolean;
    report: LifecycleReport;
}

function record(ctx: Ctx, step: string, workspaceId: string, detail: string): void {
    ctx.report.actions.push({ step, workspaceId, detail });
    ctx.report.counts[step] = (ctx.report.counts[step] ?? 0) + 1;
}

function recordError(ctx: Ctx, step: string, workspaceId: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : 'Unknown';
    ctx.report.errors.push({ step, workspaceId, detail });
    logger.error('Billing lifecycle step failed', { step, workspaceId, error: detail });
}

function marketOf(ws: Pick<Workspace, 'market'>): Market {
    return ws.market === 'US' ? 'US' : 'BR';
}

function planName(plan: string): string {
    return PLANS[plan as PlanType]?.name ?? plan;
}

async function ownerOf(workspaceId: string): Promise<(BillingRecipient & { userId: string }) | null> {
    const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId, role: 'OWNER' },
        orderBy: { createdAt: 'asc' },
        select: { userId: true, user: { select: { email: true, name: true, market: true } } },
    });
    if (!member?.user.email) return null;
    return { userId: member.userId, email: member.user.email, name: member.user.name, market: member.user.market };
}

async function notifyOwner(workspaceId: string, send: (to: BillingRecipient) => Promise<boolean>): Promise<void> {
    const owner = await ownerOf(workspaceId);
    if (owner) await send(owner);
}

/**
 * Fields that put a workspace on the free plan with no subscription. Former subscribers
 * keep the standard FREE allowance (not the US signup override of 0).
 */
export function freePlanData(): Partial<Workspace> {
    return {
        plan: 'FREE',
        leadsLimit: PLANS.FREE.leadsLimit,
        subscriptionStatus: 'canceled',
        subscriptionId: null,
        customerId: null,
        currentPeriodEnd: null,
        billingCycle: null,
        gracePeriodEnd: null,
        pendingPlanId: null,
        pendingPlanEffectiveAt: null,
        creditsResetAt: null,
        renewalPaymentId: null,
        renewalPaymentUrl: null,
        renewalPaymentQrCode: null,
        renewalPaymentExpiresAt: null,
    };
}

/** Price of the next charge for a workspace (Starter promo while promo payments remain). */
export function renewalAmountBrl(ws: Pick<Workspace, 'plan' | 'billingCycle' | 'promoPaymentsRemaining' | 'promoRegularAmountBrl'>): number {
    const cycle = toCycle(ws.billingCycle);
    if (ws.plan === STARTER_PROMO_BR.mapsToPlan && cycle === 'monthly' && (ws.promoPaymentsRemaining ?? 0) > 0) {
        return STARTER_PROMO_BR.promoPriceBrl;
    }
    return getMarketPlanPrices(ws.plan as PlanType, cycle, 'BR').primary;
}

// ── 1. Trials ───────────────────────────────────────────────────────────────

async function runTrials(ctx: Ctx): Promise<void> {
    const expired = await prisma.workspace.findMany({
        where: { plan: 'TRIAL', subscriptionStatus: TRIAL_STATUS, currentPeriodEnd: { lt: ctx.now } },
        select: { id: true },
    });
    for (const { id } of expired) {
        record(ctx, 'trial_expired', id, 'trial ended');
        if (ctx.dryRun) continue;
        await prisma.workspace.update({
            where: { id },
            data: { subscriptionStatus: TRIAL_EXPIRED_STATUS, starterPromoEligible: true },
        });
        await notifyOwner(id, (to) => sendTrialExpiredEmail(id, to));
    }

    const ending = await prisma.workspace.findMany({
        where: {
            plan: 'TRIAL',
            subscriptionStatus: TRIAL_STATUS,
            currentPeriodEnd: { gte: ctx.now, lte: addDays(ctx.now, 1) },
        },
        select: { id: true, currentPeriodEnd: true },
    });
    for (const ws of ending) {
        record(ctx, 'trial_expiring_notice', ws.id, `ends ${ws.currentPeriodEnd?.toISOString()}`);
        if (ctx.dryRun || !ws.currentPeriodEnd) continue;
        const end = ws.currentPeriodEnd;
        await notifyOwner(ws.id, (to) => sendTrialExpiringEmail(ws.id, to, end));
    }
}

// ── 2. Grace period ─────────────────────────────────────────────────────────

async function runGrace(ctx: Ctx): Promise<void> {
    const expired = await prisma.workspace.findMany({
        where: { subscriptionStatus: 'past_due', gracePeriodEnd: { lt: ctx.now } },
        select: { id: true, market: true, subscriptionId: true },
    });
    for (const ws of expired) {
        record(ctx, 'grace_expired', ws.id, `subscription ${ws.subscriptionId ?? '-'}`);
        if (ctx.dryRun) continue;
        try {
            if (isMpPreapprovalId(ws.subscriptionId)) {
                await cancelPreApproval(ws.subscriptionId!).catch((err: unknown) => {
                    logger.warn('Grace expiry: cancel PreApproval failed', { workspaceId: ws.id, error: err instanceof Error ? err.message : 'Unknown' });
                });
            }
            await prisma.workspace.update({ where: { id: ws.id }, data: freePlanData() });
            await notifyOwner(ws.id, (to) => sendGraceExpiredEmail(ws.id, to));
        } catch (err) {
            recordError(ctx, 'grace_expired', ws.id, err);
        }
    }
}

// ── 3. Pending plan changes ─────────────────────────────────────────────────

type PendingWorkspace = Pick<
    Workspace,
    'id' | 'plan' | 'market' | 'subscriptionId' | 'pendingPlanId' | 'currentPeriodEnd' | 'billingCycle' | 'promoPaymentsRemaining' | 'promoRegularAmountBrl'
>;

/**
 * Applies a scheduled plan change. Downgrades keep the subscription and only change
 * its price (MP card) — cancelling it would leave the customer on a paid plan with no
 * billing at all. Cancel-to-FREE ends the subscription.
 */
export async function applyPendingPlanChange(ws: PendingWorkspace, now = new Date()): Promise<boolean> {
    const target = ws.pendingPlanId as PlanType | null;
    if (!target || !(target in PLANS)) return false;
    const market = marketOf(ws);

    if (target === 'FREE') {
        if (isMpPreapprovalId(ws.subscriptionId)) {
            await cancelPreApproval(ws.subscriptionId!).catch((err: unknown) => {
                logger.warn('Pending FREE: cancel PreApproval failed (may already be cancelled)', { workspaceId: ws.id, error: err instanceof Error ? err.message : 'Unknown' });
            });
        }
        const res = await prisma.workspace.updateMany({
            where: { id: ws.id, pendingPlanId: ws.pendingPlanId },
            data: freePlanData(),
        });
        return res.count > 0;
    }

    if (isMpPreapprovalId(ws.subscriptionId)) {
        // Throws on failure: the change is retried on the next run instead of drifting
        // away from what Mercado Pago actually charges.
        await updatePreApprovalAmount(ws.subscriptionId!, renewalAmountBrl({ ...ws, plan: target, promoPaymentsRemaining: null }));
    }

    const res = await prisma.workspace.updateMany({
        where: { id: ws.id, pendingPlanId: ws.pendingPlanId },
        data: {
            plan: target,
            leadsLimit: getMarketLeadsLimit(target, market),
            pendingPlanId: null,
            pendingPlanEffectiveAt: null,
            ...freshCreditCycle(now, ws.currentPeriodEnd && ws.currentPeriodEnd > now ? ws.currentPeriodEnd : null),
        },
    });
    return res.count > 0;
}

async function runPendingPlans(ctx: Ctx): Promise<void> {
    const due = await prisma.workspace.findMany({
        // Manual grants (no subscriptionId) are changed by an admin, not by the cron.
        where: { pendingPlanId: { not: null }, pendingPlanEffectiveAt: { lte: ctx.now }, subscriptionId: { not: null } },
        select: {
            id: true, plan: true, market: true, subscriptionId: true, pendingPlanId: true, currentPeriodEnd: true,
            billingCycle: true, promoPaymentsRemaining: true, promoRegularAmountBrl: true,
        },
    });
    for (const ws of due) {
        record(ctx, 'pending_plan_applied', ws.id, `${ws.plan} -> ${ws.pendingPlanId}`);
        if (ctx.dryRun) continue;
        try {
            const applied = await applyPendingPlanChange(ws, ctx.now);
            if (applied && ws.pendingPlanId && ws.pendingPlanId !== 'FREE') {
                const target = ws.pendingPlanId as PlanType;
                await notifyOwner(ws.id, (to) =>
                    sendPlanChangedEmail(ws.id, to, planName(ws.plan), planName(target), getMarketLeadsLimit(target, marketOf(ws))));
            }
        } catch (err) {
            recordError(ctx, 'pending_plan_applied', ws.id, err);
        }
    }
}

// ── 4. Monthly credit cycle ─────────────────────────────────────────────────

async function runCreditCycle(ctx: Ctx): Promise<void> {
    // Paid workspaces with a live period but no cycle anchor yet (subscribed before
    // credit cycles existed): start the cycle without wiping current usage.
    const unanchored = await prisma.workspace.findMany({
        where: { plan: { in: PAID_PLANS }, creditsResetAt: null, currentPeriodEnd: { gt: ctx.now } },
        select: { id: true, currentPeriodEnd: true },
    });
    for (const ws of unanchored) {
        const resetAt = nextCreditsResetAt(ctx.now, ws.currentPeriodEnd);
        record(ctx, 'credits_cycle_started', ws.id, `next reset ${resetAt.toISOString()}`);
        if (!ctx.dryRun) await prisma.workspace.update({ where: { id: ws.id }, data: { creditsResetAt: resetAt } });
    }

    const due = await prisma.workspace.findMany({
        where: {
            plan: { in: PAID_PLANS },
            creditsResetAt: { lte: ctx.now },
            OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: ctx.now } }],
        },
        select: { id: true, leadsUsed: true, leadsLimit: true, creditsResetAt: true, currentPeriodEnd: true },
    });
    for (const ws of due) {
        // Keep the monthly anchor (e.g. always the 15th) even if the job skipped days.
        let next = ws.creditsResetAt!;
        while (next <= ctx.now) next = nextCreditsResetAt(next, ws.currentPeriodEnd);
        const expired = Math.max(0, ws.leadsLimit - ws.leadsUsed);
        record(ctx, 'credits_reset', ws.id, `${expired} unused credits expired; next reset ${next.toISOString()}`);
        if (ctx.dryRun) continue;
        await prisma.workspace.updateMany({
            where: { id: ws.id, creditsResetAt: ws.creditsResetAt },
            data: { leadsUsed: 0, creditsResetAt: next },
        });
    }
}

// ── 5. Credits expiring notice ──────────────────────────────────────────────

async function runCreditsExpiringNotices(ctx: Ctx): Promise<void> {
    const soon = await prisma.workspace.findMany({
        where: {
            plan: { in: PAID_PLANS },
            creditsResetAt: { gt: ctx.now, lte: addDays(ctx.now, CREDITS_EXPIRING_NOTICE_DAYS) },
            leadsLimit: { lt: UNLIMITED_LEADS_THRESHOLD },
        },
        select: { id: true, leadsUsed: true, leadsLimit: true, creditsResetAt: true },
    });
    for (const ws of soon) {
        const remaining = ws.leadsLimit - ws.leadsUsed;
        if (remaining < Math.max(1, Math.ceil(ws.leadsLimit * CREDITS_NOTICE_MIN_SHARE))) continue;
        record(ctx, 'credits_expiring_notice', ws.id, `${remaining}/${ws.leadsLimit} unused`);
        if (ctx.dryRun) continue;
        const resetAt = ws.creditsResetAt!;
        await notifyOwner(ws.id, (to) => sendCreditsExpiringEmail(ws.id, to, remaining, ws.leadsLimit, resetAt));
    }
}

// ── 6. Recurring PIX ────────────────────────────────────────────────────────

async function runPixRenewals(ctx: Ctx): Promise<void> {
    const due = await prisma.workspace.findMany({
        where: {
            plan: { in: PAID_PLANS },
            market: 'BR',
            subscriptionId: { startsWith: 'mp_pay_' },
            subscriptionStatus: 'active',
            // A scheduled cancellation means no renewal charge.
            OR: [{ pendingPlanId: null }, { pendingPlanId: { not: 'FREE' } }],
            currentPeriodEnd: {
                gt: addDays(ctx.now, -PERIOD_GRACE_DAYS),
                lte: addDays(ctx.now, PIX_RENEWAL_LEAD_DAYS),
            },
        },
    });
    const notifyUrl = `${getSiteUrlForMarket('BR').replace(/\/$/, '')}/api/billing/webhook/mercadopago`;

    for (const ws of due) {
        const periodEnd = ws.currentPeriodEnd!;
        const hasOpenCharge = ws.renewalPaymentId != null && ws.renewalPaymentExpiresAt != null && ws.renewalPaymentExpiresAt > ctx.now;
        if (hasOpenCharge) continue;

        // A pending downgrade takes effect at period end, so the next cycle is billed at the new plan.
        const nextPlan = (ws.pendingPlanId && ws.pendingPlanId in PLANS ? ws.pendingPlanId : ws.plan) as PlanType;
        const amount = renewalAmountBrl({ ...ws, plan: nextPlan });
        record(ctx, 'pix_renewal_charge', ws.id, `${nextPlan} R$${amount} (period ends ${periodEnd.toISOString()})`);
        if (ctx.dryRun) continue;
        try {
            const owner = await ownerOf(ws.id);
            if (!owner) throw new Error('Workspace has no owner with email');
            const charge = await createPixRenewalCharge({
                workspaceId: ws.id,
                userId: owner.userId,
                payerEmail: owner.email,
                payerName: owner.name,
                planId: nextPlan,
                planName: planName(nextPlan),
                cycle: toCycle(ws.billingCycle),
                amountBrl: amount,
                notificationUrl: notifyUrl,
            }, ctx.now);
            await prisma.workspace.update({
                where: { id: ws.id },
                data: {
                    renewalPaymentId: charge.id,
                    renewalPaymentUrl: charge.ticketUrl,
                    renewalPaymentQrCode: charge.qrCode,
                    renewalPaymentExpiresAt: charge.expiresAt,
                },
            });
            await sendPixRenewalEmail(ws.id, owner, {
                planName: planName(nextPlan),
                amountBrl: amount,
                periodEnd,
                ticketUrl: charge.ticketUrl,
                qrCode: charge.qrCode,
                paymentId: charge.id,
            });
        } catch (err) {
            recordError(ctx, 'pix_renewal_charge', ws.id, err);
        }
    }
}

// ── 7. Paid period expiry ───────────────────────────────────────────────────

/** Returns the provider's real period end when the subscription is still being paid. */
async function providerPeriodEnd(subscriptionId: string | null, now: Date): Promise<Date | null> {
    if (isStripeSubscriptionId(subscriptionId)) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId!) as unknown as { status: string; current_period_end: number };
        if (sub.status === 'active' || sub.status === 'trialing') return new Date(sub.current_period_end * 1000);
        return null;
    }
    if (isMpPreapprovalId(subscriptionId)) {
        const pre = await getPreApproval(subscriptionId!);
        const next = pre.next_payment_date ? new Date(pre.next_payment_date) : null;
        if (pre.status === 'authorized' && next && next > now) return next;
        return null;
    }
    return null;
}

/**
 * PIX customer whose plan just expired: generate a charge for the same plan so they can
 * reactivate in one step. It arrives through the webhook as a renewal and restores the plan.
 */
async function createReactivationPix(
    ws: Pick<Workspace, 'id' | 'plan' | 'billingCycle' | 'promoPaymentsRemaining' | 'promoRegularAmountBrl'>,
    ctx: Ctx,
): Promise<ReactivationPix | undefined> {
    const owner = await ownerOf(ws.id);
    if (!owner) return undefined;
    const plan = ws.plan as PlanType;
    const amount = renewalAmountBrl(ws);
    const charge = await createPixRenewalCharge({
        workspaceId: ws.id,
        userId: owner.userId,
        payerEmail: owner.email,
        payerName: owner.name,
        planId: plan,
        planName: planName(plan),
        cycle: toCycle(ws.billingCycle),
        amountBrl: amount,
        notificationUrl: `${getSiteUrlForMarket('BR').replace(/\/$/, '')}/api/billing/webhook/mercadopago`,
    }, ctx.now);
    await prisma.workspace.update({
        where: { id: ws.id },
        data: {
            renewalPaymentId: charge.id,
            renewalPaymentUrl: charge.ticketUrl,
            renewalPaymentQrCode: charge.qrCode,
            renewalPaymentExpiresAt: charge.expiresAt,
        },
    });
    record(ctx, 'reactivation_pix', ws.id, `${plan} R$${amount} (payment ${charge.id})`);
    return { amountBrl: amount, ticketUrl: charge.ticketUrl, qrCode: charge.qrCode, expiresAt: charge.expiresAt };
}

async function runExpiry(ctx: Ctx): Promise<void> {
    const cutoff = addDays(ctx.now, -PERIOD_GRACE_DAYS);
    const expired = await prisma.workspace.findMany({
        where: {
            plan: { in: PAID_PLANS },
            currentPeriodEnd: { lt: cutoff },
            // Manual/admin grants have no subscriptionId and are managed by hand — never auto-expired.
            subscriptionId: { not: null },
            OR: [{ subscriptionStatus: null }, { NOT: { subscriptionStatus: 'past_due' } }], // past_due: grace step
        },
        select: {
            id: true, plan: true, market: true, subscriptionId: true, currentPeriodEnd: true,
            billingCycle: true, promoPaymentsRemaining: true, promoRegularAmountBrl: true,
        },
    });
    for (const ws of expired) {
        try {
            const liveEnd = await providerPeriodEnd(ws.subscriptionId, ctx.now);
            if (liveEnd) {
                record(ctx, 'period_synced', ws.id, `provider still active until ${liveEnd.toISOString()}`);
                if (!ctx.dryRun) {
                    await prisma.workspace.update({
                        where: { id: ws.id },
                        data: { currentPeriodEnd: liveEnd, subscriptionStatus: 'active', ...freshCreditCycle(ctx.now, liveEnd) },
                    });
                }
                continue;
            }
            record(ctx, 'plan_expired', ws.id, `${ws.plan} ended ${ws.currentPeriodEnd?.toISOString()} (${ws.subscriptionId ?? 'no subscription'})`);
            if (ctx.dryRun) continue;
            if (isMpPreapprovalId(ws.subscriptionId)) {
                await cancelPreApproval(ws.subscriptionId!).catch(() => undefined);
            }
            await prisma.workspace.update({ where: { id: ws.id }, data: freePlanData() });
            const end = ws.currentPeriodEnd!;
            const pix = isMpOneTimeId(ws.subscriptionId) && ws.market !== 'US'
                ? await createReactivationPix(ws, ctx).catch((err: unknown) => {
                    recordError(ctx, 'reactivation_pix', ws.id, err);
                    return undefined;
                })
                : undefined;
            await notifyOwner(ws.id, (to) => sendPlanExpiredEmail(ws.id, to, planName(ws.plan), end, pix));
        } catch (err) {
            recordError(ctx, 'plan_expired', ws.id, err);
        }
    }
}

// ── 8. Activation emails ────────────────────────────────────────────────────

async function runActivation(ctx: Ctx): Promise<void> {
    const { runActivationEmails } = await import('@/lib/activation-lifecycle');
    const r = await runActivationEmails(ctx.now, ctx.dryRun);
    if (r.firstSearch) ctx.report.counts.activation_first_search = r.firstSearch;
    if (r.nudge) ctx.report.counts.activation_nudge = r.nudge;
}

// ── 9. Win-back emails ──────────────────────────────────────────────────────

async function runReengagement(ctx: Ctx): Promise<void> {
    const { runReengagementEmails } = await import('@/lib/reengagement');
    const r = await runReengagementEmails(ctx.now, ctx.dryRun);
    if (r.sent) {
        ctx.report.counts.reengagement_sent = r.sent;
        ctx.report.counts.reengagement_new_companies = r.fromRf;
        ctx.report.counts.reengagement_own_history = r.fromHistory;
    }
}

// ── 10. Sales routine reminders ─────────────────────────────────────────────

async function runFollowUps(ctx: Ctx): Promise<void> {
    const { runFollowUpReminders } = await import('@/lib/sales-routine');
    const r = await runFollowUpReminders(ctx.now, ctx.dryRun);
    if (r.candidates) ctx.report.counts.followup_candidates = r.candidates;
    if (r.sent) ctx.report.counts.followup_sent = r.sent;
    if (r.pushed) ctx.report.counts.followup_pushed = r.pushed;
}

// ── 11. Contact enrichment ──────────────────────────────────────────────────

async function runEnrichment(ctx: Ctx): Promise<void> {
    const { runEmailEnrichment } = await import('@/lib/email-enrichment');
    const r = await runEmailEnrichment(ctx.dryRun);
    if (r.checked) ctx.report.counts.email_enrich_checked = r.checked;
    if (r.found) ctx.report.counts.email_enrich_found = r.found;
}

export async function runBillingLifecycleJob(options: { dryRun?: boolean; now?: Date } = {}): Promise<LifecycleReport> {
    const ctx: Ctx = {
        now: options.now ?? new Date(),
        dryRun: options.dryRun === true,
        report: { dryRun: options.dryRun === true, actions: [], errors: [], counts: {} },
    };
    const steps: Array<[string, (c: Ctx) => Promise<void>]> = [
        ['trials', runTrials],
        ['grace', runGrace],
        ['pending', runPendingPlans],
        ['credits', runCreditCycle],
        ['credits_notice', runCreditsExpiringNotices],
        ['pix', runPixRenewals],
        ['expiry', runExpiry],
        ['activation', runActivation],
        ['reengagement', runReengagement],
        ['followups', runFollowUps],
        ['email_enrichment', runEnrichment],
    ];
    for (const [name, step] of steps) {
        try {
            await step(ctx);
        } catch (err) {
            recordError(ctx, name, '-', err);
        }
    }
    logger.info('Billing lifecycle job completed', { dryRun: ctx.dryRun, counts: ctx.report.counts, errors: ctx.report.errors.length });
    return ctx.report;
}
