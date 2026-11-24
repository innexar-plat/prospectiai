import { stripe } from '@/lib/stripe';

/** Days of free trial (card required) on a first Stripe subscription. */
export const STRIPE_TRIAL_DAYS = 7;

/**
 * One trial per e-mail: anyone who already had a Stripe subscription (any status, any workspace)
 * pays from day one. Stripe is the source of truth, so a new workspace with the same e-mail
 * does not unlock another trial.
 */
export async function stripeTrialEligible(email: string | null | undefined): Promise<boolean> {
    if (!email) return false;
    try {
        const customers = await stripe.customers.list({ email, limit: 10 });
        for (const c of customers.data) {
            const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 1 });
            if (subs.data.length > 0) return false;
        }
        return true;
    } catch {
        return false; // when in doubt, no trial (never give away a free month by accident)
    }
}
