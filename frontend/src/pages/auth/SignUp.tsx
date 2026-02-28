import React, { useState } from "react"
import { Link } from "react-router-dom"
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Shield, Search, Brain, Zap } from "lucide-react"
import { authApi } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Logo } from "@/components/brand/Logo"

export default function SignUpPage() {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const handleEmailSignUp = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError('As senhas não coincidem')
            return
        }

        setIsLoading(true)
        setError('')

        try {
            await authApi.register({ email, password, name })
            await authApi.signIn({ email, password, callbackUrl: '/onboarding' })
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao criar conta')
            setIsLoading(false)
        }
    }

    return (
        <div className="h-screen min-h-[600px] grid lg:grid-cols-2 bg-background selection:bg-violet-500/30 overflow-hidden">
            {/* LEFT SIDE: Visual/Value Prop – compacto */}
            <div className="hidden lg:flex flex-col justify-center p-6 lg:p-8 xl:p-10 relative border-r border-border bg-[radial-gradient(circle_at_0%_0%,rgba(139,92,246,0.1)_0%,transparent_50%)]">
                <div className="relative z-10">
                    <div className="mb-5">
                        <Logo iconSize={40} textClassName="text-foreground text-lg" />
                    </div>
                    <h2 className="text-3xl xl:text-4xl font-black text-foreground leading-tight mb-5">
                        Comece a <span className="accent-gradient">Prospectar</span> com Inteligência.
                    </h2>

                    <div className="space-y-4 mt-5">
                        {[
                            { icon: <Search size={20} />, title: 'Encontre Leads Qualificados', desc: 'Filtre por nicho, região e tamanho em segundos.' },
                            { icon: <Brain size={20} />, title: 'Análise de IA', desc: 'IA analisa cada lead para o melhor fit.' },
                            { icon: <Shield size={20} />, title: 'Dados Verificados', desc: 'Dados atualizados e reais.' }
                        ].map((item) => (
                            <div key={item.title} className="flex gap-3">
                                <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-violet-500 shrink-0">
                                    {item.icon}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-foreground font-bold text-sm mb-0.5">{item.title}</h4>
                                    <p className="text-muted text-xs leading-snug">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-surface border border-border flex items-center gap-3 card-shadow">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                            <Zap size={16} />
                        </div>
                        <p className="text-xs font-bold text-muted">
                            <span className="text-green-600 dark:text-green-400">Free:</span> 5 créditos grátis para começar.
                        </p>
                    </div>
                </div>
                <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-violet-600/10 blur-[80px] rounded-full pointer-events-none" />
            </div>

            {/* RIGHT SIDE: Form – sem scroll, espaço em cima e embaixo, card menor */}
            <div className="flex flex-col justify-center items-center py-8 px-4 md:px-6 overflow-hidden">
                <div className="w-full max-w-[360px] animate-fade py-4 md:py-5 md:card-shadow md:rounded-2xl md:border md:border-border md:bg-card/80 md:backdrop-blur-sm md:px-5">
                    <div className="lg:hidden flex justify-center mb-6">
                        <Logo iconSize={36} iconOnly={false} textClassName="text-foreground text-sm" />
                    </div>

                    <div className="mb-4 text-center lg:text-left">
                        <h1 className="text-xl font-black text-foreground mb-1">Criar conta</h1>
                        <p className="text-muted text-xs">Junte-se a milhares de empresas que já usam ProspectorAI.</p>
                    </div>

                    <form onSubmit={handleEmailSignUp} className="space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Nome Completo</label>
                            <Input
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Seu nome"
                                icon={<UserIcon size={16} />}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">E-mail Corporativo</label>
                            <Input
                                required
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                icon={<Mail size={16} />}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Senha</label>
                                <Input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Senha"
                                    minLength={8}
                                    icon={<Lock size={16} />}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Confirmar</label>
                                <Input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Senha"
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
                                {showPassword ? <><EyeOff size={12} /> Ocultar</> : <><Eye size={12} /> Mostrar senhas</>}
                            </button>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
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
                            Começar Agora Gratuitamente
                        </Button>
                    </form>

                    <div className="my-4 flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-black text-muted uppercase tracking-wider">ou</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                            type="button"
                            onClick={() => { authApi.initiateOAuthSignIn('google', '/onboarding').catch(() => {}); }}
                            variant="secondary"
                            className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
                            icon={<img src="https://authjs.dev/img/providers/google.svg" width={20} height={20} alt="" className="shrink-0" />}
                        >
                            Google
                        </Button>
                        <Button
                            type="button"
                            onClick={() => { authApi.initiateOAuthSignIn('github', '/onboarding').catch(() => {}); }}
                            variant="secondary"
                            className="h-10 text-xs font-semibold border border-border hover:border-violet-500/30"
                            icon={<img src="https://authjs.dev/img/providers/github.svg" width={20} height={20} alt="" className="shrink-0" />}
                        >
                            GitHub
                        </Button>
                    </div>

                    <p className="mt-4 text-center text-xs text-muted">
                        Já possui uma conta?{' '}
                        <Link to="/auth/signin" className="text-violet-500 hover:text-violet-400 font-bold hover:underline">
                            Entrar
                        </Link>
                    </p>

                    <p className="mt-3 text-center text-[10px] text-muted leading-snug">
                        Ao se cadastrar, você concorda com nossos{' '}
                        <Link to="/terms" className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">Termos</Link> e{' '}
                        <Link to="/privacy" className="underline focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">Privacidade</Link>.
                    </p>
                </div>
            </div>
        </div>
    )
}
