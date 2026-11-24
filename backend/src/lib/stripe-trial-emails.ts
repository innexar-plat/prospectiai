/**
 * Stripe free trial (card on file): reminder sent on Stripe's `customer.subscription.trial_will_end`
 * event, three days before the first charge — fair to the customer and it reduces disputes.
 */
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { buildEmail } from '@/lib/email-templates';
import { getSiteUrlForMarket } from '@/lib/site-url';

export async function sendTrialEndingEmail(sub: Stripe.Subscription): Promise<boolean> {
    const userId = sub.metadata?.userId;
    if (!userId || !sub.trial_end) return false;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) return false;
    const base = getSiteUrlForMarket('US').replace(/\/$/, '');
    const when = new Date(sub.trial_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const item = sub.items?.data?.[0];
    const amount = item?.price?.unit_amount != null ? `$${(item.price.unit_amount / 100).toFixed(2)}` : 'your plan price';
    const html = buildEmail({
        locale: 'en',
        title: 'Your free trial ends in 3 days',
        preheader: `Your card will be charged ${amount} on ${when} unless you cancel.`,
        userName: user.name ?? undefined,
        body: [
            `Your Precision AI free trial ends on <strong>${when}</strong>. On that day your card will be charged ${amount} and your plan continues — nothing else to do.`,
            'Not for you? Cancel before that date in Plans and you will not be charged.',
        ],
        ctaHref: `${base}/dashboard/planos`,
        ctaLabel: 'Manage my plan',
        siteUrl: base,
    });
    const r = await sendEmail(user.email, 'Your free trial ends in 3 days', html);
    return r.sent;
}
