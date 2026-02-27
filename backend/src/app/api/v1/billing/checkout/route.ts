import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';
import { preference } from '@/lib/mercadopago';
import { rateLimit } from '@/lib/ratelimit';
import { PLANS, PlanType, BillingCycle } from '@/lib/billing-config';
import { checkoutSchema, formatZodError } from '@/lib/validations/schemas';

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success } = await rateLimit(`checkout:${session.user.id}`, 10, 60);
    if (!success) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = checkoutSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { planId, locale, cycle = 'monthly' } = parsed.data;
        const plan = PLANS[planId as PlanType];

        if (!plan || planId === 'FREE') {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
        }

        const billingCycle = cycle as BillingCycle;

        if (locale === 'pt') {
            // Mercado Pago Checkout (Brazil)
            const mpPreference = await preference.create({
                body: {
                    items: [
                        {
                            id: planId,
                            title: `ProspectorAI Plano ${plan.name} (${billingCycle})`,
                            description: `Assinatura para ${plan.leadsLimit} buscas por mês.`,
                            quantity: 1,
                            unit_price: plan[billingCycle].price_brl,
                            currency_id: 'BRL'
                        }
                    ],
                    back_urls: {
                        success: `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/success`,
                        failure: `${process.env.NEXT_PUBLIC_APP_URL}/`,
                        pending: `${process.env.NEXT_PUBLIC_APP_URL}/`
                    },
                    auto_return: 'approved',
                    notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/webhook/mercadopago`,
                    metadata: {
                        userId: session.user.id,
                        planId,
                    }
                }
            });

            return NextResponse.json({ url: mpPreference.init_point });
        } else {
            // Stripe Checkout (International)
            const stripeSession = await stripe.checkout.sessions.create({
                customer_email: session.user.email,
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `ProspectorAI ${plan.name} Plan (${billingCycle})`,
                                description: `Subscription for ${plan.leadsLimit} leads searches per month.`,
                            },
                            unit_amount: plan[billingCycle].price_usd * 100,
                            recurring: { interval: billingCycle === 'annual' ? 'year' : 'month' },
                        },
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
                metadata: {
                    userId: session.user.id,
                    planId,
                },
            });

            return NextResponse.json({ url: stripeSession.url });
        }
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Checkout Error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
}
