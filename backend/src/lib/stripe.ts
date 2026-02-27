import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';

/** SDK types may not include this version; cast required. */
const apiVersion = '2025-01-27.acacia' as Stripe.StripeConfig['apiVersion'];

export const stripe = new Stripe(stripeKey, {
    apiVersion,
    typescript: true,
});
