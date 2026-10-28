/**
 * Automatic billing lifecycle emails (credits expiring, PIX renewal, renewal confirmed,
 * plan expired, cancellation, trial). Each send is deduplicated with a Redis SET-NX key
 * so a cron re-run never emails the same customer twice for the same event.
 * Fire-and-forget: failures are logged, never thrown.
 */
import { buildEmail, trialExpiringTemplate, trialExpiredTemplate, subscriptionCancelledTemplate, dunningThirdTemplate } from '@/lib/email-templates';
import { sendEmail } from '@/lib/email';
import { acquireRedisLock } from '@/lib/redis';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { logger } from '@/lib/logger';

const DEDUP_TTL_MS = 45 * 24 * 60 * 60 * 1000;

const BRAND_COLOR = '#4F46E5';
const SUCCESS_COLOR = '#059669';
const WARNING_COLOR = '#d97706';
const DANGER_COLOR = '#dc2626';

export interface BillingRecipient {
    email: string;
    name?: string | null;
    market?: string | null;
}

function siteFor(recipient: BillingRecipient): string {
    return getSiteUrlForMarket(recipient.market === 'US' ? 'US' : 'BR').replace(/\/$/, '');
}

function isEn(recipient: BillingRecipient): boolean {
    return recipient.market === 'US';
}

function fmtDate(date: Date, en: boolean): string {
    return date.toLocaleDateString(en ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

function fmtNumber(n: number, en: boolean): string {
    return n.toLocaleString(en ? 'en-US' : 'pt-BR');
}

function fmtBrl(n: number): string {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function escapeText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendOnce(dedupKey: string, to: string, subject: string, html: string): Promise<boolean> {
    try {
        const first = await acquireRedisLock(`billing-email:${dedupKey}`, '1', DEDUP_TTL_MS);
        if (!first) return false;
        const result = await sendEmail(to, subject, html);
        if (result.sent) logger.info('Billing lifecycle email sent', { dedupKey, to });
        return result.sent;
    } catch (err) {
        logger.warn('Billing lifecycle email failed', { dedupKey, error: err instanceof Error ? err.message : 'Unknown' });
        return false;
    }
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Unused credits expire at the next cycle — nudge the customer to use them. */
export function sendCreditsExpiringEmail(
    workspaceId: string,
    to: BillingRecipient,
    remaining: number,
    limit: number,
    resetAt: Date,
): Promise<boolean> {
    const en = isEn(to);
    const base = siteFor(to);
    const html = buildEmail({
        title: en
            ? `You still have ${fmtNumber(remaining, en)} credits — they expire ${fmtDate(resetAt, en)}`
            : `Você ainda tem ${fmtNumber(remaining, en)} créditos — eles vencem em ${fmtDate(resetAt, en)}`,
        preheader: en ? 'Unused credits do not roll over to the next cycle.' : 'Créditos não usados não acumulam para o próximo ciclo.',
        userName: to.name ?? undefined,
        body: en
            ? [
                `Your plan includes <strong>${fmtNumber(limit, en)} credits per month</strong> and you still have <strong>${fmtNumber(remaining, en)}</strong> available.`,
                `On <strong>${fmtDate(resetAt, en)}</strong> your credits are renewed and the unused balance expires — it does not carry over.`,
                'Run a few searches now and turn those credits into qualified leads.',
            ]
            : [
                `Seu plano inclui <strong>${fmtNumber(limit, en)} créditos por mês</strong> e você ainda tem <strong>${fmtNumber(remaining, en)}</strong> disponíveis.`,
                `Em <strong>${fmtDate(resetAt, en)}</strong> seus créditos são renovados e o saldo não utilizado vence — ele não acumula para o próximo mês.`,
                'Faça suas buscas agora e transforme esses créditos em leads qualificados.',
            ],
        ctaHref: `${base}/dashboard/search`,
        ctaLabel: en ? 'Use my credits' : 'Usar meus créditos',
        accentColor: WARNING_COLOR,
        siteUrl: base,
        locale: en ? 'en' : 'pt',
    });
    const subject = en
        ? `${fmtNumber(remaining, en)} credits expire on ${fmtDate(resetAt, en)}`
        : `Seus ${fmtNumber(remaining, en)} créditos vencem em ${fmtDate(resetAt, en)}`;
    return sendOnce(`credits-expiring:${workspaceId}:${dayKey(resetAt)}`, to.email, subject, html);
}

/** Recurring PIX: the renewal charge for the next cycle is ready to pay. */
export function sendPixRenewalEmail(
    workspaceId: string,
    to: BillingRecipient,
    params: { planName: string; amountBrl: number; periodEnd: Date; ticketUrl: string | null; qrCode: string | null; paymentId: string },
): Promise<boolean> {
    const base = siteFor(to);
    const body = [
        `Sua assinatura do plano <strong>${escapeText(params.planName)}</strong> vence em <strong>${fmtDate(params.periodEnd, false)}</strong>.`,
        `Geramos o PIX de renovação no valor de <strong>${fmtBrl(params.amountBrl)}</strong>. Assim que o pagamento for confirmado, seu plano é renovado automaticamente e seus créditos voltam ao limite total.`,
    ];
    if (params.qrCode) {
        body.push(`<strong>PIX copia e cola:</strong><br><span style="font-family:monospace;font-size:12px;word-break:break-all;">${escapeText(params.qrCode)}</span>`);
    }
    body.push('Se o pagamento não for feito até o vencimento, sua conta tem 3 dias de tolerância antes de voltar ao plano gratuito.');
    const html = buildEmail({
        title: 'Seu PIX de renovação está disponível',
        preheader: `Renove o plano ${params.planName} — ${fmtBrl(params.amountBrl)} via PIX.`,
        userName: to.name ?? undefined,
        body,
        ctaHref: params.ticketUrl ?? `${base}/dashboard/planos`,
        ctaLabel: 'Pagar com PIX',
        accentColor: BRAND_COLOR,
        footerNote: 'Prefere não se preocupar todo mês? Assine com cartão de crédito e a renovação é automática.',
        siteUrl: base,
    });
    return sendOnce(`pix-renewal:${workspaceId}:${params.paymentId}`, to.email, `Renove seu plano ${params.planName} — PIX disponível`, html);
}

/** Payment received for a new cycle (PIX renewal or card subscription charge). */
export function sendRenewalConfirmedEmail(
    workspaceId: string,
    to: BillingRecipient,
    params: { planName: string; leadsLimit: number; periodEnd: Date; paymentId: string },
): Promise<boolean> {
    const en = isEn(to);
    const base = siteFor(to);
    const html = buildEmail({
        title: en ? 'Payment received — your plan was renewed' : 'Pagamento confirmado — plano renovado',
        preheader: en ? 'Your credits are back to the full limit.' : 'Seus créditos voltaram ao limite total.',
        userName: to.name ?? undefined,
        body: en
            ? [
                `Your <strong>${escapeText(params.planName)}</strong> plan is renewed until <strong>${fmtDate(params.periodEnd, en)}</strong>.`,
                `You have <strong>${fmtNumber(params.leadsLimit, en)} credits</strong> available this month.`,
            ]
            : [
                `Seu plano <strong>${escapeText(params.planName)}</strong> foi renovado até <strong>${fmtDate(params.periodEnd, en)}</strong>.`,
                `Você tem <strong>${fmtNumber(params.leadsLimit, en)} créditos</strong> disponíveis neste mês. Lembre-se: créditos não usados vencem no fim de cada ciclo mensal.`,
            ],
        ctaHref: `${base}/dashboard/search`,
        ctaLabel: en ? 'Start prospecting' : 'Começar a prospectar',
        accentColor: SUCCESS_COLOR,
        siteUrl: base,
        locale: en ? 'en' : 'pt',
    });
    return sendOnce(`renewal-confirmed:${workspaceId}:${params.paymentId}`, to.email, en ? 'Your plan was renewed' : 'Seu plano foi renovado', html);
}

/** Paid period ended without payment — workspace moved to the free plan. */
export interface ReactivationPix {
    amountBrl: number;
    ticketUrl: string | null;
    qrCode: string | null;
    expiresAt: Date;
}

export function sendPlanExpiredEmail(
    workspaceId: string,
    to: BillingRecipient,
    planName: string,
    periodEnd: Date,
    pix?: ReactivationPix,
): Promise<boolean> {
    const en = isEn(to);
    const base = siteFor(to);
    if (pix && !en) {
        // PIX customers get a ready-to-pay reactivation charge instead of a generic "renew" link.
        const body = [
            `Não identificamos o pagamento do seu plano <strong>${escapeText(planName)}</strong>, que venceu em ${fmtDate(periodEnd, false)}, e sua conta voltou para o plano gratuito.`,
            `Para reativar, geramos um PIX de <strong>${fmtBrl(pix.amountBrl)}</strong>, válido até <strong>${fmtDate(pix.expiresAt, false)}</strong>. Assim que for pago, o plano ${escapeText(planName)} volta na hora, com os créditos completos. Seus leads e histórico continuam salvos.`,
        ];
        if (pix.qrCode) {
            body.push(`<strong>PIX copia e cola:</strong><br><span style="font-family:monospace;font-size:12px;word-break:break-all;">${escapeText(pix.qrCode)}</span>`);
        }
        const html = buildEmail({
            title: 'Seu plano expirou — reative com PIX',
            preheader: `Reative o plano ${planName} pagando ${fmtBrl(pix.amountBrl)} via PIX.`,
            userName: to.name ?? undefined,
            body,
            ctaHref: pix.ticketUrl ?? `${base}/dashboard/planos`,
            ctaLabel: 'Pagar PIX e reativar',
            accentColor: BRAND_COLOR,
            footerNote: 'Prefere renovação automática? Assine com cartão de crédito em Planos.',
            siteUrl: base,
        });
        return sendOnce(`plan-expired:${workspaceId}:${dayKey(periodEnd)}`, to.email, `Seu plano ${planName} expirou — PIX para reativar`, html);
    }
    const html = buildEmail({
        title: en ? 'Your plan has expired' : 'Seu plano expirou',
        preheader: en ? 'Renew to get your credits back.' : 'Renove para recuperar seus créditos.',
        userName: to.name ?? undefined,
        body: en
            ? [
                `We did not receive the payment for your <strong>${escapeText(planName)}</strong> plan, which ended on ${fmtDate(periodEnd, en)}.`,
                'Your account was moved to the free plan. Your leads and history are kept — renew any time to continue.',
            ]
            : [
                `Não identificamos o pagamento do seu plano <strong>${escapeText(planName)}</strong>, que venceu em ${fmtDate(periodEnd, en)}.`,
                'Sua conta voltou para o plano gratuito. Seus leads e histórico continuam salvos — renove quando quiser para continuar prospectando.',
            ],
        ctaHref: `${base}/dashboard/planos`,
        ctaLabel: en ? 'Renew my plan' : 'Renovar meu plano',
        accentColor: DANGER_COLOR,
        siteUrl: base,
        locale: en ? 'en' : 'pt',
    });
    return sendOnce(`plan-expired:${workspaceId}:${dayKey(periodEnd)}`, to.email, en ? 'Your plan has expired' : 'Seu plano Precision IA expirou', html);
}

/** Scheduled downgrade was applied at period end. */
export function sendPlanChangedEmail(workspaceId: string, to: BillingRecipient, fromPlan: string, toPlan: string, leadsLimit: number): Promise<boolean> {
    const base = siteFor(to);
    const html = buildEmail({
        title: `Seu plano agora é ${escapeText(toPlan)}`,
        preheader: 'A alteração de plano agendada foi aplicada.',
        userName: to.name ?? undefined,
        body: [
            `Conforme agendado, seu plano mudou de <strong>${escapeText(fromPlan)}</strong> para <strong>${escapeText(toPlan)}</strong>.`,
            `Seu novo limite é de <strong>${fmtNumber(leadsLimit, false)} créditos por mês</strong>.`,
        ],
        ctaHref: `${base}/dashboard/planos`,
        ctaLabel: 'Ver meu plano',
        accentColor: BRAND_COLOR,
        siteUrl: base,
    });
    return sendOnce(`plan-changed:${workspaceId}:${toPlan}:${dayKey(new Date())}`, to.email, `Seu plano mudou para ${toPlan}`, html);
}

export function sendSubscriptionCancelledEmail(workspaceId: string, to: BillingRecipient, planName: string, accessUntil: Date): Promise<boolean> {
    const base = siteFor(to);
    const html = subscriptionCancelledTemplate(planName, accessUntil, `${base}/dashboard/planos`, to.name ?? undefined);
    return sendOnce(`subscription-cancelled:${workspaceId}:${dayKey(accessUntil)}`, to.email, 'Sua assinatura foi cancelada', html);
}

export function sendGraceExpiredEmail(workspaceId: string, to: BillingRecipient): Promise<boolean> {
    const base = siteFor(to);
    const html = dunningThirdTemplate(`${base}/dashboard/planos`, to.name ?? undefined);
    return sendOnce(`grace-expired:${workspaceId}:${dayKey(new Date())}`, to.email, 'Sua conta foi suspensa por falta de pagamento', html);
}

export function sendTrialExpiringEmail(workspaceId: string, to: BillingRecipient, trialEnd: Date): Promise<boolean> {
    if (isEn(to)) return Promise.resolve(false);
    const base = siteFor(to);
    const html = trialExpiringTemplate(trialEnd, `${base}/dashboard/planos`, to.name ?? undefined);
    return sendOnce(`trial-expiring:${workspaceId}`, to.email, 'Seu teste gratuito termina amanhã', html);
}

export function sendTrialExpiredEmail(workspaceId: string, to: BillingRecipient): Promise<boolean> {
    if (isEn(to)) return Promise.resolve(false);
    const base = siteFor(to);
    const html = trialExpiredTemplate(`${base}/dashboard/planos`, to.name ?? undefined);
    return sendOnce(`trial-expired:${workspaceId}`, to.email, 'Seu teste gratuito encerrou', html);
}
