import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Package, Users, Sparkles } from 'lucide-react'
import { authApi, onboardingApi, type SessionUser } from '@/lib/api'
import { trackPendingFreeSignupConversion } from '@/lib/marketing'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/brand/Logo'
import { useI18n } from '@/lib/i18n'
import { getActiveMarket } from '@/lib/market'
import { isCheckoutDone } from '@/lib/post-auth-redirect'
import { markPostOnboardingVisit } from '@/lib/first-search-hint'

export default function OnboardingPage({ user }: { user: SessionUser | null }) {
    const navigate = useNavigate()
    const { t, setLocale, locale } = useI18n()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [verificationWarning, setVerificationWarning] = useState('')
    const [resendingVerification, setResendingVerification] = useState(false)
    const [resendSuccess, setResendSuccess] = useState('')
    const [companyName, setCompanyName] = useState('')
    const [productService, setProductService] = useState('')
    const [targetAudience, setTargetAudience] = useState('')
    const [mainBenefit, setMainBenefit] = useState('')

    useEffect(() => {
        const market = getActiveMarket()
        const expectedLocale = market === 'BR' ? 'pt' : 'en'
        if (locale !== expectedLocale) {
            setLocale(expectedLocale)
        }
    }, [locale, setLocale])

    useEffect(() => {
        const warning = sessionStorage.getItem('signup-verification-email-warning')
        if (warning) {
            setVerificationWarning(warning)
        }
    }, [])

    useEffect(() => {
        if (user?.requiresOnboarding && !isCheckoutDone()) {
            navigate('/checkout', { replace: true })
            return
        }
        if (user) {
            if (!user.requiresOnboarding) {
                navigate('/dashboard', { replace: true })
                return
            }
            queueMicrotask(() => setLoading(false))
        } else if (user === null) {
            navigate('/auth/signin', { replace: true })
        }
    }, [user, navigate])

    useEffect(() => {
        if (!user?.requiresOnboarding) return
        void trackPendingFreeSignupConversion()
    }, [user])

    const handleResendVerification = async () => {
        if (resendingVerification) return
        setResendingVerification(true)
        setResendSuccess('')
        try {
            const result = await authApi.resendVerification()
            if (result.sent) {
                sessionStorage.removeItem('signup-verification-email-warning')
                setVerificationWarning('')
                setResendSuccess(t('page.onboarding.resendSuccess'))
                return
            }
            setVerificationWarning(result.error || t('page.onboarding.verifyWarningTitle'))
        } catch (error) {
            setVerificationWarning(error instanceof Error ? error.message : t('page.onboarding.verifyWarningTitle'))
        } finally {
            setResendingVerification(false)
        }
    }

    const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            await onboardingApi.complete({
                companyName: companyName.trim() || undefined,
                productService: productService.trim() || undefined,
                targetAudience: targetAudience.trim() || undefined,
                mainBenefit: mainBenefit.trim() || undefined,
            })
            markPostOnboardingVisit()
            window.location.href = '/dashboard'
        } catch {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted">{t('auth.loading')}</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Logo height={48} />
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-foreground mb-2">{t('page.onboarding.title')}</h1>
                    <p className="text-muted text-sm">
                        {t('page.onboarding.subtitle')}
                    </p>
                </div>

                {verificationWarning && (
                    <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-left text-amber-900 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        <p className="text-sm font-bold">{t('page.onboarding.verifyWarningTitle')}</p>
                        <p className="mt-1 text-xs leading-relaxed">{verificationWarning}</p>
                        <button
                            type="button"
                            onClick={handleResendVerification}
                            disabled={resendingVerification}
                            className="mt-3 inline-flex items-center justify-center rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {resendingVerification ? t('page.onboarding.resending') : t('page.onboarding.resend')}
                        </button>
                        {resendSuccess && (
                            <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{resendSuccess}</p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('page.onboarding.company')}</label>
                        <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder={t('page.onboarding.companyPlaceholder')}
                            icon={<Building2 size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('page.onboarding.product')}</label>
                        <Input
                            value={productService}
                            onChange={(e) => setProductService(e.target.value)}
                            placeholder={t('page.onboarding.productPlaceholder')}
                            icon={<Package size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('page.onboarding.audience')}</label>
                        <Input
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder={t('page.onboarding.audiencePlaceholder')}
                            icon={<Users size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('page.onboarding.benefit')}</label>
                        <Input
                            value={mainBenefit}
                            onChange={(e) => setMainBenefit(e.target.value)}
                            placeholder={t('page.onboarding.benefitPlaceholder')}
                            icon={<Sparkles size={16} />}
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={submitting}
                        variant="primary"
                        className="w-full h-11 text-sm font-black mt-6"
                        isLoading={submitting}
                    >
                        {t('page.onboarding.submit')}
                    </Button>
                </form>
            </div>
        </div>
    )
}
