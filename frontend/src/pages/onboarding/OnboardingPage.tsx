import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Package, Users, Sparkles } from 'lucide-react'
import { type SessionUser } from '@/lib/api'
import { onboardingApi } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/brand/Logo'

export default function OnboardingPage({ user }: { user: SessionUser | null }) {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [companyName, setCompanyName] = useState('')
    const [productService, setProductService] = useState('')
    const [targetAudience, setTargetAudience] = useState('')
    const [mainBenefit, setMainBenefit] = useState('')

    useEffect(() => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            await onboardingApi.complete({
                companyName: companyName.trim() || undefined,
                productService: productService.trim() || undefined,
                targetAudience: targetAudience.trim() || undefined,
                mainBenefit: mainBenefit.trim() || undefined,
            })
            // Use a hard redirect to force App.tsx to reload the user session
            // with the updated requiresOnboarding flag.
            window.location.href = '/dashboard'
        } catch {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-muted">Carregando...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-8">
                    <Logo iconSize={40} textClassName="text-foreground text-lg" />
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-black text-foreground mb-2">Conta criada com sucesso!</h1>
                    <p className="text-muted text-sm">
                        Conte um pouco sobre seu negócio para personalizarmos sua experiência. Você pode pular e preencher depois.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Empresa</label>
                        <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Nome da empresa"
                            icon={<Building2 size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Produto ou serviço</label>
                        <Input
                            value={productService}
                            onChange={(e) => setProductService(e.target.value)}
                            placeholder="O que você vende ou oferece?"
                            icon={<Package size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Público-alvo</label>
                        <Input
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            placeholder="Quem é seu cliente ideal?"
                            icon={<Users size={16} />}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Principal benefício</label>
                        <Input
                            value={mainBenefit}
                            onChange={(e) => setMainBenefit(e.target.value)}
                            placeholder="Diferencial do seu negócio"
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
                        Continuar para o dashboard
                    </Button>
                </form>
            </div>
        </div>
    )
}
