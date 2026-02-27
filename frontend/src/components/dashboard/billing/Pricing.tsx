'use client';
import { useState } from 'react';
import { Check, Rocket, Zap, Crown, ArrowLeft, Star } from 'lucide-react';
import { type PlanType } from '@/lib/billing-config';

type TFunction = (key: string, options?: Record<string, string>) => string;
type TRawFunction = (prefix: string) => string[];

const fallbackT: TFunction = (key) => key;
const fallbackRaw: TRawFunction = (prefix) => [`${prefix}.1`, `${prefix}.2`, `${prefix}.3`];

export default function Pricing({
    locale,
    currentPlan,
    onBack,
    userEmail,
    t: tProp,
    tRaw,
}: {
    locale: string;
    currentPlan: PlanType;
    onBack?: () => void;
    userEmail?: string;
    t?: TFunction;
    tRaw?: TRawFunction;
}) {
    console.debug(userEmail);
    const [loading, setLoading] = useState<string | null>(null);
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
    const t = tProp ?? fallbackT;
    const raw = tRaw ?? fallbackRaw;

    const handleCheckout = async (planId: string) => {
        if (planId === 'FREE') return;

        setLoading(planId);
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, interval, locale })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert(t('billing.processing_error') || 'Error starting checkout');
            }
        } catch (err) {
            console.error(err);
            alert(t('auth.connectionError') || 'Unexpected error');
        } finally {
            setLoading(null);
        }
    };

    const plans = [
        {
            id: 'FREE',
            name: t('billing.free.name'),
            price: t('billing.free.price'),
            description: t('billing.free.desc'),
            leads: t('billing.free.leads'),
            features: raw('billing.free.features'),
            icon: <Zap size={24} />,
            color: '#94a3b8'
        },
        {
            id: 'BASIC',
            name: t('billing.basic.name'),
            price: interval === 'monthly' ? t('billing.basic.priceMonthly') : t('billing.basic.priceAnnual'),
            description: t('billing.basic.desc'),
            leads: t('billing.basic.leads'),
            features: raw('billing.basic.features'),
            icon: <Rocket size={24} />,
            color: '#3b82f6', // blue
        },
        {
            id: 'PRO',
            name: t('billing.pro.name'),
            price: interval === 'monthly' ? t('billing.pro.priceMonthly') : t('billing.pro.priceAnnual'),
            description: t('billing.pro.desc'),
            leads: t('billing.pro.leads'),
            features: raw('billing.pro.features'),
            icon: <Crown size={24} />,
            color: '#8b5cf6', // purple
            popular: true
        },
        {
            id: 'BUSINESS',
            name: t('billing.business.name'),
            price: interval === 'monthly' ? t('billing.business.priceMonthly') : t('billing.business.priceAnnual'),
            description: t('billing.business.desc'),
            leads: t('billing.business.leads'),
            features: raw('billing.business.features'),
            icon: <Star size={24} />,
            color: '#f59e0b'
        }
    ];

    /* Theme-aware: use CSS variables so text/background contrast in light and dark (WCAG) */
    const styles = {
        page: { padding: '60px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', flex: 1, overflowY: 'auto' as const, position: 'relative' as const },
        backBtn: { background: 'none', border: 'none', color: 'var(--theme-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px', fontSize: '14px', fontWeight: 600 },
        title: { fontSize: '42px', fontWeight: 900, color: 'var(--theme-text)', marginBottom: '16px' },
        subtitle: { color: 'var(--theme-muted)', fontSize: '18px', maxWidth: '600px', margin: '0 auto', marginBottom: '40px' },
        toggleWrap: { display: 'inline-flex', background: 'var(--theme-surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--theme-border)' },
        toggleBtn: (active: boolean) => ({
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: active ? 'var(--color-accent-primary)' : 'transparent',
            color: active ? '#fff' : 'var(--theme-text)', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
        }),
        card: (popular: boolean) => ({
            background: 'var(--theme-card)',
            borderRadius: '24px',
            border: popular ? '2px solid var(--color-accent-primary)' : '1px solid var(--theme-border)',
            padding: '40px',
            position: 'relative' as const,
            display: 'flex',
            flexDirection: 'column' as const,
            transition: 'transform 0.2s, box-shadow 0.3s',
            boxShadow: 'var(--theme-shadow-card)',
            ...(popular && { boxShadow: 'var(--theme-shadow-card-hover)' })
        }),
        badge: { position: 'absolute' as const, top: 0, right: '40px', transform: 'translateY(-50%)', background: 'var(--color-accent-primary)', color: '#fff', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' as const },
        planName: { fontSize: '24px', fontWeight: 800, color: 'var(--theme-text)', marginBottom: '8px' },
        planDesc: { color: 'var(--theme-muted)', fontSize: '14px', marginBottom: '24px', minHeight: '40px' },
        price: { fontSize: '36px', fontWeight: 900, color: 'var(--theme-text)' },
        priceSuffix: { color: 'var(--theme-muted)', fontSize: '16px' },
        leadsLabel: { fontWeight: 700, color: 'var(--theme-text)', marginBottom: '16px', fontSize: '15px' },
        featureItem: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--theme-muted)' },
        ctaBtn: (popular: boolean, disabled: boolean) => ({
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            border: 'none',
            background: popular ? 'var(--color-accent-primary)' : 'var(--theme-surface)',
            color: popular ? '#fff' : 'var(--theme-text)',
            fontWeight: 700,
            fontSize: '16px',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'opacity 0.2s'
        })
    };

    return (
        <div style={styles.page}>
            <button type="button" onClick={onBack} style={styles.backBtn}>
                <ArrowLeft size={16} /> {t('billing.backToDashboard')}
            </button>

            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h1 style={styles.title}>{t('billing.title')}</h1>
                <p style={styles.subtitle}>{t('billing.subtitle')}</p>

                <div style={styles.toggleWrap}>
                    <button type="button" onClick={() => setInterval('monthly')} style={styles.toggleBtn(interval === 'monthly')}>
                        {t('billing.monthlyLabel')}
                    </button>
                    <button type="button" onClick={() => setInterval('annual')} style={{ ...styles.toggleBtn(interval === 'annual'), display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t('billing.annualLabel')} <span style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#16a34a', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>{t('billing.offLabel')}</span>
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                {plans.map((plan) => (
                    <div key={plan.id} style={styles.card(!!plan.popular)}>
                        {plan.popular && (
                            <div style={styles.badge}>{t('billing.popular')}</div>
                        )}

                        <div style={{ color: plan.color, marginBottom: '20px' }}>{plan.icon}</div>
                        <h2 style={styles.planName}>{plan.name}</h2>
                        <p style={styles.planDesc}>{plan.description}</p>

                        <div style={{ marginBottom: '32px' }}>
                            <span style={styles.price}>{plan.price}</span>
                            <span style={styles.priceSuffix}>/{interval === 'monthly' ? t('billing.perMonth') : t('billing.perYear')}</span>
                        </div>

                        <div style={{ marginBottom: '32px', flex: 1 }}>
                            <div style={styles.leadsLabel}>{plan.leads}</div>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {plan.features.map((f: string, i: number) => (
                                    <li key={i} style={styles.featureItem}>
                                        <Check size={16} color={plan.color} /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <button
                            type="button"
                            disabled={currentPlan === plan.id || loading === plan.id}
                            onClick={() => handleCheckout(plan.id)}
                            style={styles.ctaBtn(!!plan.popular, currentPlan === plan.id || loading === plan.id)}
                        >
                            {loading === plan.id ? t('billing.processing') : (currentPlan === plan.id ? t('billing.currentPlan').replace('{plan}', plan.name) : t('billing.subscribe'))}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
