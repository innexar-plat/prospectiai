import React, { useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Shield, Search, Brain, Zap } from "lucide-react"
import { authApi } from "@/lib/api"
import { markPendingFreeSignupConversion } from "@/lib/marketing"
import { getRealNameValidationMessage, normalizePersonName } from "@/lib/realName"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { captureRefFromUrl, getAffiliateRef } from "@/lib/affiliate-ref"
import { getSignupCallbackPath } from '@/lib/post-auth-redirect'
import { isTrialEnabled } from '@/lib/market'
import { useI18n } from '@/lib/i18n'

const SIGNUP_BENEFITS = [
    { icon: Search, titleKey: 'auth.signUpBenefit1Title', descKey: 'auth.signUpBenefit1Desc' },
    { icon: Brain, titleKey: 'auth.signUpBenefit2Title', descKey: 'auth.signUpBenefit2Desc' },
    { icon: Shield, titleKey: 'auth.signUpBenefit3Title', descKey: 'auth.signUpBenefit3Desc' },
] as const

export default function SignUpPage() {
    const { t } = useI18n();
    const [searchParams] = useSearchParams();
    const callbackUrlParam = searchParams.get('callbackUrl');
    const trialEnabled = isTrialEnabled();
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        captureRefFromUrl()
    }, [])

    const handleEmailSignUp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()

        const normalizedName = normalizePersonName(name)
        const nameValidationError = getRealNameValidationMessage(normalizedName)
        if (nameValidationError) {
            setError(nameValidationError)
            return
        }

        if (password !== confirmPassword) {
            setError(t('auth.passwordMismatch'))
            return
        }

        setIsLoading(true)
        setError('')

        const affiliateCode = getAffiliateRef()
        try {
            const result = await authApi.register({ email, password, name: normalizedName, ...(affiliateCode && { affiliateCode }) })
            if (!result.verificationEmailSent) {
                sessionStorage.setItem(
                    'signup-verification-email-warning',
                    result.verificationEmailError || t('page.onboarding.verifyWarningTitle')
                )
            } else {
                sessionStorage.removeItem('signup-verification-email-warning')
            }
            if (trialEnabled) {
                markPendingFreeSignupConversion()
            }
            await authApi.signIn({
                email,
                password,
                callbackUrl: getSignupCallbackPath(callbackUrlParam),
            })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('auth.registerError'))
            setIsLoading(false)
        }
    }

    return (
        <AuthLayout
            sideTitle={
                <>
                    {t('auth.signUpSideTitlePrefix')}{' '}
                    <span className="accent-gradient">{t('auth.signUpSideTitleAccent')}</span>{' '}
                    {t('auth.signUpSideTitleSuffix')}
                </>
            }
            sideDescription={t('auth.signUpSideDesc')}
            sideElements={
                <div className="space-y-4 mt-5">
                    {SIGNUP_BENEFITS.map((item) => {
                        const Icon = item.icon
                        return (
                            <div key={item.titleKey} className="flex gap-3">
                                <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-violet-500 shrink-0">
                                    <Icon size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-foreground font-bold text-sm mb-0.5">{t(item.titleKey)}</h4>
                                    <p className="text-muted text-xs leading-snug">{t(item.descKey)}</p>
                                </div>
                            </div>
                        )
                    })}
                    {trialEnabled && (
                    <div className="mt-6 p-4 rounded-2xl bg-surface border border-border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                            <Zap size={16} />
                        </div>
                        <p className="text-xs font-bold text-muted">{t('auth.signUpTrialNote')}</p>
                    </div>
                    )}
                    {!trialEnabled && (
                    <div className="mt-6 p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-500 shrink-0">
                            <Zap size={16} />
                        </div>
                        <p className="text-xs font-bold text-muted">{t('auth.signUpUsNote')}</p>
                    </div>
                    )}
                </div>
            }
            formTitle={t('auth.signUpTitle')}
            formSubtitle={t('auth.signUpSubtitle')}
        >
            <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('auth.fullName')}</label>
                    <Input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder={t('auth.fullNamePlaceholder')}
                        icon={<UserIcon size={16} />}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('auth.corporateEmail')}</label>
                    <Input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        icon={<Mail size={16} />}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('auth.password')}</label>
                        <Input
                            required
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={t('auth.passwordPlaceholder')}
                            minLength={8}
                            icon={<Lock size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">{t('auth.confirmPassword')}</label>
                        <Input
                            required
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder={t('auth.passwordPlaceholder')}
                            icon={<Lock size={16} />}
                        />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-muted hover:text-foreground transition-colors flex items-center gap-1.5 text-[10px] font-bold"
                    >
                        {showPassword ? <><EyeOff size={12} /> {t('auth.hidePasswords')}</> : <><Eye size={12} /> {t('auth.showPasswords')}</>}
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-200 dark:bg-red-500/10 border border-red-600 dark:border-red-500/20 rounded-xl text-red-900 dark:text-red-400 text-xs font-bold text-center">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    variant="primary"
                    className="w-full h-10 text-sm font-black shadow-violet-600/20"
                    isLoading={isLoading}
                >
                    {trialEnabled ? t('auth.signUpButtonTrial') : t('auth.signUpButtonUs')}
                </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-black text-muted uppercase tracking-wider">{t('auth.or')}</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                    type="button"
                    onClick={() => {
                        if (trialEnabled) markPendingFreeSignupConversion()
                        authApi.initiateOAuthSignIn('google', getSignupCallbackPath(callbackUrlParam)).catch(() => { })
                    }}
                    variant="secondary"
                    className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
                    icon={<img src="/icons/google.svg" width={20} height={20} alt="Google" className="shrink-0" />}
                >
                    Google
                </Button>
                <Button
                    type="button"
                    onClick={() => {
                        if (trialEnabled) markPendingFreeSignupConversion()
                        authApi.initiateOAuthSignIn('github', getSignupCallbackPath(callbackUrlParam)).catch(() => { })
                    }}
                    variant="secondary"
                    className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
                    icon={<img src="/icons/github.svg" width={20} height={20} alt="GitHub" className="shrink-0" />}
                >
                    GitHub
                </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted">
                {t('auth.hasAccount')}{' '}
                <Link to="/auth/signin" className="text-violet-500 hover:text-violet-600 dark:text-violet-400 font-bold hover:underline">
                    {t('auth.signIn')}
                </Link>
            </p>

            <p className="mt-3 text-center text-[10px] text-muted leading-snug">
                {t('auth.termsAgree')}{' '}
                <Link to="/terms" className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">{t('auth.terms')}</Link>{' '}
                {t('auth.and')}{' '}
                <Link to="/privacy" className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">{t('auth.privacy')}</Link>.
            </p>
        </AuthLayout>
    )
}
