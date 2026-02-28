import React, { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Logo } from "@/components/brand/Logo"

export default function SignInPage() {
    const [searchParams] = useSearchParams()
    const errorParam = searchParams.get('error')
    const callbackUrlParam = searchParams.get('callbackUrl')
    const resolvedCallbackPath = callbackUrlParam && callbackUrlParam.startsWith('/')
        ? callbackUrlParam
        : undefined;
    const oauthCallbackPath =
        callbackUrlParam && callbackUrlParam.startsWith('http')
            ? (() => {
                try {
                    return new URL(callbackUrlParam).pathname || '/onboarding'
                } catch {
                    return '/onboarding'
                }
            })()
            : (resolvedCallbackPath ?? '/onboarding')

    // Auto-set error if coming back from failed login
    React.useEffect(() => {
        if (errorParam === 'CredentialsSignin') {
            setError('Email ou senha inválidos. Verifique e tente novamente.')
        } else if (errorParam) {
            setError('Ocorreu um erro ao entrar. Tente novamente.')
        }
    }, [errorParam])

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            await authApi.signIn({ email, password, callbackUrl: callbackUrlParam ?? undefined })
            return
        } catch (err) {
            console.error('SignIn error details:', err)
            setError('Email ou senha inválidos. Verifique e tente novamente.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="h-screen min-h-[600px] grid lg:grid-cols-2 bg-background selection:bg-violet-500/30 overflow-hidden">
            {/* LEFT SIDE: Visual/Value Prop */}
            <div className="hidden lg:flex flex-col justify-center p-8 lg:p-10 xl:p-12 relative overflow-hidden border-r border-border bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_50%)]">
                <div className="relative z-10 max-w-md">
                    <div className="mb-6">
                        <Logo iconSize={40} textClassName="text-foreground text-lg" />
                    </div>
                    <h2 className="text-3xl xl:text-4xl font-black text-foreground leading-tight mb-5">
                        Bem-vindo de volta ao <span className="accent-gradient">ProspectorAI</span>.
                    </h2>
                    <p className="text-muted leading-relaxed mb-8">
                        Continue encontrando os melhores leads B2B com nossa inteligência artificial avançada.
                    </p>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-muted font-bold text-sm">
                            <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
                                <ArrowRight size={14} />
                            </div>
                            <span>Acesse seus leads salvos</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted font-bold text-sm">
                            <div className="w-6 h-6 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400 shrink-0">
                                <ArrowRight size={14} />
                            </div>
                            <span>Analise novas empresas com IA</span>
                        </div>
                    </div>
                </div>
                <div className="absolute top-1/2 -right-24 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />
            </div>

            {/* RIGHT SIDE: Form – sem scroll, espaço em cima e embaixo */}
            <div className="flex flex-col justify-center items-center py-8 px-6 md:px-10">
                <div className="w-full max-w-[380px] animate-fade">
                    <div className="lg:hidden flex justify-center mb-6">
                        <Logo iconSize={36} iconOnly={false} textClassName="text-foreground text-sm" />
                    </div>

                    <div className="mb-6 text-center lg:text-left">
                        <h1 className="text-2xl font-black text-foreground mb-1">Entrar</h1>
                        <p className="text-muted text-sm">Entre com suas credenciais para continuar.</p>
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">E-mail</label>
                            <Input
                                required
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                icon={<Mail size={18} />}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-muted uppercase tracking-widest ml-1">Senha</label>
                                <Link to="/auth/forgot-password" className="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors">
                                    Esqueceu a senha?
                                </Link>
                            </div>
                            <Input
                                required
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Sua senha"
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

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold text-center animate-shake">
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
                            Acessar Plataforma
                        </Button>
                    </form>

                    <div className="my-6 flex items-center gap-4">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">ou</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button
                            type="button"
                            onClick={() => { authApi.initiateOAuthSignIn('google', oauthCallbackPath).catch(() => {}); }}
                            variant="secondary"
                            className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
                            icon={<img src="https://authjs.dev/img/providers/google.svg" width={24} height={24} alt="" className="shrink-0" />}
                        >
                            Continuar com Google
                        </Button>
                        <Button
                            type="button"
                            onClick={() => { authApi.initiateOAuthSignIn('github', oauthCallbackPath).catch(() => {}); }}
                            variant="secondary"
                            className="h-11 text-xs font-semibold border border-border hover:border-violet-500/30"
                            icon={<img src="https://authjs.dev/img/providers/github.svg" width={24} height={24} alt="" className="shrink-0" />}
                        >
                            Continuar com GitHub
                        </Button>
                    </div>

                    <p className="mt-6 text-center text-xs text-muted">
                        Não tem uma conta?{' '}
                        <Link to="/auth/signup" className="text-violet-400 hover:text-violet-300 font-bold transition-all hover:underline decoration-2 underline-offset-4">
                            Criar conta grátis
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
