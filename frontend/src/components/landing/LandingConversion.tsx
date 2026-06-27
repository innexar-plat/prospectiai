'use client';

import { Link } from 'react-router-dom';
import {
    Check,
    ArrowRight,
    Zap,
    Target,
    MessageSquare,
    BarChart3,
    Shield,
    Star,
    Search,
    Brain,
    Rocket,
    XCircle,
    CheckCircle2,
    Quote,
    Sparkles,
    Users,
    Clock,
    TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { TFunction } from '@/components/layout/Header';
import { US_STARTER_CREDITS } from '@/lib/market';

interface LandingConversionProps {
    locale: string;
    t: TFunction;
    onSignup: () => void;
    onPricing: () => void;
}

const FEATURE_ICONS = [Search, Brain, MessageSquare, BarChart3, Target, Users] as const;
const STAT_ICONS = [Users, Clock, TrendingUp, Zap] as const;

const US_PLANS = [
    {
        key: 'starter',
        price: 19,
        credits: US_STARTER_CREDITS,
        popular: false,
        featureCount: 4,
    },
    {
        key: 'growth',
        price: 49,
        credits: 400,
        popular: true,
        featureCount: 5,
    },
    {
        key: 'business',
        price: 99,
        credits: 1200,
        popular: false,
        featureCount: 5,
    },
] as const;

function StatCard({ icon: Icon, value, label }: { icon: typeof Zap; value: string; label: string }) {
    return (
        <div className="flex flex-col items-center gap-1.5 p-4 sm:p-5 rounded-2xl bg-card border border-border card-shadow">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center text-violet-600">
                <Icon size={18} aria-hidden />
            </div>
            <span className="text-2xl sm:text-3xl font-black accent-gradient">{value}</span>
            <span className="text-xs sm:text-sm text-muted font-medium text-center leading-snug">{label}</span>
        </div>
    );
}

function PricingCard({
    planKey,
    price,
    credits,
    popular,
    featureCount,
    t,
    onSignup,
}: {
    planKey: string;
    price: number;
    credits: number;
    popular: boolean;
    featureCount: number;
    t: TFunction;
    onSignup: () => void;
}) {
    return (
        <div
            className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 bg-card card-shadow card-shadow-hover transition-all ${
                popular
                    ? 'border-violet-500/40 ring-2 ring-violet-500/25 shadow-[0_8px_30px_rgba(124,58,237,0.12)]'
                    : 'border-border'
            }`}
        >
            {popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest">
                    {t('landing.conv.planPopular')}
                </span>
            )}
            <p className="text-sm font-bold text-muted uppercase tracking-wide">{t(`landing.conv.plan${planKey}Name`)}</p>
            <p className="mt-2 text-4xl sm:text-5xl font-black text-foreground">
                ${price}
                <span className="text-base font-medium text-muted">/mo</span>
            </p>
            <p className="text-sm text-muted mt-1">
                {credits} {t('landing.conv.creditsPerMonth')}
            </p>
            <p className="text-xs text-muted mt-2 leading-relaxed">{t(`landing.conv.plan${planKey}Desc`)}</p>
            <ul className="mt-5 space-y-2.5 flex-1">
                {Array.from({ length: featureCount }, (_, i) => i + 1).map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <Check size={16} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                        <span>{t(`landing.conv.plan${planKey}Feature${i}`)}</span>
                    </li>
                ))}
            </ul>
            <Button
                variant={popular ? 'primary' : 'secondary'}
                size="lg"
                onClick={onSignup}
                className="w-full mt-6 h-12"
            >
                {t('landing.conv.planCta')}
            </Button>
        </div>
    );
}

export default function LandingConversion({ locale, t, onSignup, onPricing }: LandingConversionProps) {
    const features = [1, 2, 3, 4, 5, 6].map((i) => ({
        icon: FEATURE_ICONS[i - 1],
        title: t(`landing.conv.feature${i}Title`),
        desc: t(`landing.conv.feature${i}Desc`),
    }));

    const stats = [1, 2, 3, 4].map((i) => ({
        icon: STAT_ICONS[i - 1],
        value: t(`landing.conv.stat${i}Value`),
        label: t(`landing.conv.stat${i}Label`),
    }));

    const problems = [1, 2, 3, 4].map((i) => t(`landing.conv.problem${i}`));
    const solutions = [1, 2, 3, 4].map((i) => t(`landing.conv.solution${i}`));

    const steps = [
        { step: '01', icon: Search, color: 'bg-violet-600' },
        { step: '02', icon: Brain, color: 'bg-cyan-600' },
        { step: '03', icon: Rocket, color: 'bg-emerald-600' },
    ] as const;

    const testimonials = [1, 2, 3].map((i) => ({
        quote: t(`landing.conv.testimonial${i}Quote`),
        name: t(`landing.conv.testimonial${i}Name`),
        role: t(`landing.conv.testimonial${i}Role`),
    }));

    const localePath = locale === 'pt' ? 'pt' : locale === 'es' ? 'es' : 'en';

    return (
        <div className="flex flex-col overflow-x-hidden">
            {/* Decorative background */}
            <div className="absolute top-0 left-0 right-0 h-[70vh] bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.15)_0%,transparent_65%)] pointer-events-none" />
            <div className="absolute top-10 left-1/4 w-72 h-72 bg-violet-500/10 blur-[100px] rounded-full pointer-events-none animate-float" />

            {/* Hero */}
            <section className="relative px-4 pt-20 pb-12 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20">
                <div className="max-w-5xl mx-auto text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[11px] sm:text-xs font-bold mb-6 border border-violet-500/20 animate-fade">
                        <Sparkles size={14} className="fill-current" aria-hidden />
                        {t('landing.conv.badge')}
                    </span>
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-foreground leading-[1.05] tracking-tight animate-slide">
                        {t('landing.conv.heroTitle')}{' '}
                        <span className="accent-gradient">{t('landing.conv.heroHighlight')}</span>
                    </h1>
                    <p className="mt-5 sm:mt-6 text-base sm:text-lg lg:text-xl text-muted max-w-2xl mx-auto leading-relaxed animate-fade animation-delay-200 animation-fill-both">
                        {t('landing.conv.heroSub')}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-semibold text-muted">
                        {[1, 2, 3].map((i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full bg-card border border-border">
                                {t(`landing.conv.heroPill${i}`)}
                            </span>
                        ))}
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-md sm:max-w-none mx-auto">
                        <Button variant="primary" size="lg" onClick={onSignup} className="w-full sm:w-auto text-base px-8 h-14 group">
                            {t('landing.conv.ctaPrimary')}
                            <ArrowRight size={18} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                        <Button variant="secondary" size="lg" onClick={onPricing} className="w-full sm:w-auto text-base px-8 h-14">
                            {t('landing.conv.ctaSecondary')}
                        </Button>
                    </div>
                    <p className="mt-4 text-xs text-muted">{t('landing.conv.heroNote')}</p>
                </div>
            </section>

            {/* Stats */}
            <section className="px-4 pb-12 sm:pb-16" aria-label={t('landing.conv.statsAria')}>
                <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {stats.map((s) => (
                        <StatCard key={s.label} icon={s.icon} value={s.value} label={s.label} />
                    ))}
                </div>
            </section>

            {/* Problem / Solution */}
            <section className="px-4 py-14 sm:py-20 bg-surface/40 border-y border-border" aria-labelledby="problem-heading">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-10 sm:mb-14">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] font-bold uppercase tracking-widest mb-4">
                            {t('landing.conv.problemBadge')}
                        </span>
                        <h2 id="problem-heading" className="text-2xl sm:text-4xl lg:text-5xl font-black text-foreground">
                            {t('landing.conv.problemTitle')}{' '}
                            <span className="accent-gradient">{t('landing.conv.problemTitleHighlight')}</span>
                        </h2>
                        <p className="mt-4 text-muted max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
                            {t('landing.conv.problemSub')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                        <div className="rounded-3xl border border-red-500/15 bg-red-500/5 p-6 sm:p-8">
                            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-5 flex items-center gap-2">
                                <XCircle size={20} aria-hidden />
                                {t('landing.conv.problemCardTitle')}
                            </h3>
                            <ul className="space-y-4">
                                {problems.map((item) => (
                                    <li key={item} className="flex items-start gap-3 text-sm text-muted leading-relaxed">
                                        <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" aria-hidden />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-3xl border border-violet-500/25 bg-violet-500/5 p-6 sm:p-8 relative">
                            <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-violet-600 text-white text-[10px] font-black uppercase tracking-widest">
                                {t('landing.conv.solutionBadge')}
                            </div>
                            <h3 className="text-lg font-bold text-violet-700 dark:text-violet-300 mb-5 flex items-center gap-2">
                                <CheckCircle2 size={20} aria-hidden />
                                {t('landing.conv.solutionCardTitle')}
                            </h3>
                            <ul className="space-y-4">
                                {solutions.map((item) => (
                                    <li key={item} className="flex items-start gap-3 text-sm text-foreground leading-relaxed">
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="px-4 py-14 sm:py-20" aria-labelledby="how-heading">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10 sm:mb-14">
                        <h2 id="how-heading" className="text-2xl sm:text-4xl font-black text-foreground">
                            {t('landing.conv.howTitle')}
                        </h2>
                        <p className="mt-3 text-muted text-sm sm:text-base max-w-xl mx-auto">{t('landing.conv.howSub')}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
                        {steps.map((item, idx) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.step}
                                    className="relative text-center p-6 sm:p-8 rounded-3xl bg-card border border-border card-shadow card-shadow-hover"
                                >
                                    <div className={`w-14 h-14 rounded-2xl ${item.color} text-white flex items-center justify-center mx-auto mb-5 shadow-lg`}>
                                        <Icon size={26} aria-hidden />
                                    </div>
                                    <span className="text-3xl font-black accent-gradient">{item.step}</span>
                                    <h3 className="text-lg font-black text-foreground mt-2 mb-2">
                                        {t(`landing.conv.step${idx + 1}Title`)}
                                    </h3>
                                    <p className="text-sm text-muted leading-relaxed">{t(`landing.conv.step${idx + 1}Desc`)}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="px-4 py-14 sm:py-20 bg-surface/30 border-y border-border" aria-labelledby="features-heading">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="text-center mb-10 sm:mb-12">
                        <h2 id="features-heading" className="text-2xl sm:text-4xl font-black text-foreground">
                            {t('landing.conv.featuresTitle')}
                        </h2>
                        <p className="mt-3 text-muted text-sm sm:text-base max-w-2xl mx-auto">{t('landing.conv.featuresSub')}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {features.map(({ icon: Icon, title, desc }) => (
                            <div
                                key={title}
                                className="group rounded-2xl border border-border bg-card p-5 sm:p-6 card-shadow card-shadow-hover"
                            >
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 text-white shadow-md group-hover:scale-105 transition-transform">
                                    <Icon size={20} aria-hidden />
                                </div>
                                <h3 className="font-bold text-foreground text-sm sm:text-base">{title}</h3>
                                <p className="text-xs sm:text-sm text-muted mt-1.5 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing — 3 plans */}
            <section className="px-4 py-14 sm:py-20" aria-labelledby="pricing-heading" id="pricing">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-10 sm:mb-12">
                        <h2 id="pricing-heading" className="text-2xl sm:text-4xl lg:text-5xl font-black text-foreground">
                            {t('landing.conv.pricingTitle')}{' '}
                            <span className="accent-gradient">{t('landing.conv.pricingTitleHighlight')}</span>
                        </h2>
                        <p className="mt-3 text-muted text-sm sm:text-base max-w-xl mx-auto">{t('landing.conv.pricingSub')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch">
                        {US_PLANS.map((plan) => (
                            <PricingCard
                                key={plan.key}
                                planKey={plan.key}
                                price={plan.price}
                                credits={plan.credits}
                                popular={plan.popular}
                                featureCount={plan.featureCount}
                                t={t}
                                onSignup={onSignup}
                            />
                        ))}
                    </div>
                    <p className="text-center text-xs text-muted mt-6">{t('landing.conv.pricingNote')}</p>
                    <div className="text-center mt-4">
                        <button
                            type="button"
                            onClick={onPricing}
                            className="text-sm font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                        >
                            {t('landing.conv.viewAllPlans')} →
                        </button>
                    </div>
                </div>
            </section>

            {/* Social proof */}
            <section className="px-4 py-14 sm:py-16 bg-surface/50 border-y border-border" aria-labelledby="social-heading">
                <div className="max-w-6xl mx-auto">
                    <h2 id="social-heading" className="text-2xl sm:text-3xl font-black text-center text-foreground mb-3">
                        {t('landing.conv.socialTitle')}
                    </h2>
                    <p className="text-center text-muted text-sm mb-8 sm:mb-10">{t('landing.conv.socialSub')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {testimonials.map((item) => (
                            <div
                                key={item.name}
                                className="p-5 sm:p-6 rounded-2xl border border-border bg-card card-shadow card-shadow-hover"
                            >
                                <div className="flex gap-0.5 mb-3">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <Star key={s} size={14} className="text-amber-500 fill-amber-500" aria-hidden />
                                    ))}
                                </div>
                                <Quote size={18} className="text-violet-500/40 mb-2" aria-hidden />
                                <p className="text-sm text-foreground font-medium leading-relaxed">&ldquo;{item.quote}&rdquo;</p>
                                <p className="text-sm font-bold text-foreground mt-4">{item.name}</p>
                                <p className="text-xs text-muted">{item.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust */}
            <section className="px-4 py-10 max-w-4xl mx-auto w-full" aria-label={t('landing.conv.trustAria')}>
                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-muted">
                    <span className="inline-flex items-center gap-2">
                        <Shield size={16} className="text-violet-500" aria-hidden /> {t('landing.conv.trust1')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <Zap size={16} className="text-violet-500" aria-hidden /> {t('landing.conv.trust2')}
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <Check size={16} className="text-emerald-500" aria-hidden /> {t('landing.conv.trust3')}
                    </span>
                </div>
            </section>

            {/* Final CTA */}
            <section className="px-4 py-14 sm:py-20">
                <div className="max-w-4xl mx-auto">
                    <div className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-indigo-700 p-8 sm:p-14 text-center text-white shadow-[var(--theme-shadow-glow)]">
                        <div
                            className="absolute inset-0 opacity-15 pointer-events-none"
                            style={{
                                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                                backgroundSize: '20px 20px',
                            }}
                        />
                        <div className="relative z-10">
                            <h2 className="text-2xl sm:text-4xl font-black leading-tight">{t('landing.conv.finalTitle')}</h2>
                            <p className="mt-3 sm:mt-4 text-violet-100 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
                                {t('landing.conv.finalSub')}
                            </p>
                            <Button
                                variant="secondary"
                                size="lg"
                                onClick={onSignup}
                                className="mt-8 bg-white text-violet-700 hover:bg-violet-50 border-0 font-bold h-14 px-10 w-full sm:w-auto"
                            >
                                {t('landing.conv.ctaPrimary')}
                                <ArrowRight size={18} className="ml-2" />
                            </Button>
                            <p className="text-white/60 text-xs mt-4">{t('landing.conv.finalNote')}</p>
                        </div>
                    </div>
                </div>
            </section>

            <div className="text-center pb-10 px-4">
                <Link
                    to={`/${localePath}/pricing`}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline font-medium"
                >
                    {t('landing.conv.viewAllPlans')} →
                </Link>
            </div>
        </div>
    );
}
