import React, { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { isTrialEnabled } from "@/lib/market";
import { useI18n } from "@/lib/i18n";

export default function SignInPage() {
    const { t } = useI18n();
    const [searchParams] = useSearchParams()
    const errorParam = searchParams.get('error')
    const errorCodeParam = searchParams.get('code')
    const callbackUrlParam = searchParams.get('callbackUrl')
    const resolvedCallbackPath = callbackUrlParam && callbackUrlParam.startsWith('/')
        ? callbackUrlParam
        : undefined;
    const oauthCallbackPath =
        callbackUrlParam && callbackUrlParam.startsWith('http')
            ? (() => {
                try {
                    const parsed = new URL(callbackUrlParam)
                    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/dashboard'
                } catch {
                    return '/dashboard'
                }
            })()
            : (resolvedCallbackPath ?? '/dashboard')

    // Auto-set error if coming back from failed login
    React.useEffect(() => {
        if (errorCodeParam === 'two_factor_required') {
            setRequires2fa(true)
        } else if (errorCodeParam === 'two_factor_invalid') {
            setRequires2fa(true)
            setError(t('auth.twoFactorInvalid'))
        } else if (errorParam === 'CredentialsSignin') {
            setError(t('auth.signInError'))
        } else if (errorParam) {
            setError(t('auth.signInGenericError'))
        }
    }, [errorParam, errorCodeParam, t])

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [twoFaCode, setTwoFaCode] = useState('')
    const [requires2fa, setRequires2fa] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const signupTo = callbackUrlParam
        ? `/auth/signup?callbackUrl=${encodeURIComponent(callbackUrlParam)}`
        : '/auth/signup'

    const handleEmailSignIn = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            await authApi.signIn({
                email,
                password,
                code: requires2fa ? twoFaCode : undefined,
                callbackUrl: callbackUrlParam ?? undefined,
            })
            return
        } catch (err) {
            console.error('SignIn error details:', err)
            setError(t('auth.signInError'))
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <AuthLayout
            sideTitle={<>{t('auth.signInWelcome')} <span className="accent-gradient">Precision</span>.</>}
            sideDescription={t('auth.signInSideDesc')}
            sideElements={
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-muted font-bold text-sm">
                        <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                            <ArrowRight size={14} />
                        </div>
                        <span>{t('auth.signInBenefit1')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted font-bold text-sm">
                        <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                            <ArrowRight size={14} />
                        </div>
                        <span>{t('auth.signInBenefit2')}</span>
                    </div>
                </div>
            }
            formTitle={t('auth.signInTitle')}
            formSubtitle={t('auth.signInSubtitle')}
        >
            <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">{t('auth.email')}</label>
                    <Input
                        required
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        icon={<Mail size={18} />}
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">{t('auth.password')}</label>
                        <Link to="/auth/forgot-password" className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">
                            {t('auth.forgotPassword')}
                        </Link>
                    </div>
                    <Input
                        required
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        icon={<Lock size={18} />}
                        className="pr-12"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-[38px] text-muted hover:text-foreground transition-colors"
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {requires2fa && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">{t('auth.twoFactorCode')}</label>
                        <Input
                            required
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={twoFaCode}
                            onChange={e => setTwoFaCode(e.target.value)}
                            placeholder={t('auth.twoFactorCodePlaceholder')}
                            icon={<Lock size={18} />}
                        />
                        {!error && (
                            <p className="text-xs text-muted ml-1">{t('auth.twoFactorRequired')}</p>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-200 dark:bg-red-500/10 border border-red-600 dark:border-red-500/20 rounded-2xl text-red-900 dark:text-red-400 text-sm font-bold text-center animate-shake">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    variant="primary"
                    className="w-full h-11 text-sm font-black shadow-violet-600/20"
                    isLoading={isLoading}
                >
                    {t('auth.signInButton')}
                </Button>
            </form>

            <div className="my-6 flex items-center gap-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">{t('auth.or')}</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                    type="button"
                    onClick={() => { authApi.initiateOAuthSignIn('google', oauthCallbackPath).catch(() => { }); }}
                    variant="secondary"
                    className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
                    icon={<img src="/icons/google.svg" width={24} height={24} alt="Google" className="shrink-0" />}
                >
                    Google
                </Button>
                <Button
                    type="button"
                    onClick={() => { authApi.initiateOAuthSignIn('github', oauthCallbackPath).catch(() => { }); }}
                    variant="secondary"
                    className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
                    icon={<img src="/icons/github.svg" width={24} height={24} alt="GitHub" className="shrink-0" />}
                >
                    GitHub
                </Button>
            </div>

            <p className="mt-6 text-center text-xs text-muted">
                {t('auth.noAccount')}{' '}
                <Link to={signupTo} className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-bold transition-all hover:underline decoration-2 underline-offset-4">
                    {isTrialEnabled() ? t('auth.signUpFree') : t('auth.signUp')}
                </Link>
            </p>
        </AuthLayout>
    )
}
