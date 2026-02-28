import { useState, useEffect } from 'react';
import { CreditCard, Zap, Crown, Rocket, Check, Loader2, Clock, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { billingApi, plansApi, type PlanFromApi } from '@/lib/api';
import { getPlanDisplayName } from '@/lib/billing-config';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

/** UI-only mapping: icon, colors, and feature labels per plan key (from DB we get name, leadsLimit, price). */
const PLAN_UI: Record<string, { icon: LucideIcon; color: string; borderColor: string; popular?: boolean; features: string[] }> = {
    FREE: { icon: Zap, color: 'text-zinc-400', borderColor: 'border-zinc-500/20', features: ['Busca por nicho e região', 'Score IA por lead', 'Histórico de buscas', 'Smart Tags'] },
    BASIC: { icon: CreditCard, color: 'text-blue-400', borderColor: 'border-blue-500/20', features: ['Tudo do Free', 'Exportação CSV/JSON', 'Activity Tracking'] },
    PRO: { icon: Crown, color: 'text-violet-400', borderColor: 'border-violet-500/30', popular: true, features: ['Tudo do Starter', 'Análise de concorrência', 'Ação comercial (scripts, WhatsApp)'] },
    BUSINESS: { icon: Rocket, color: 'text-amber-400', borderColor: 'border-amber-500/20', features: ['Tudo do Growth', 'Inteligência de mercado', 'Viabilidade de negócio com IA', 'Gestão de equipe'] },
    SCALE: { icon: Rocket, color: 'text-amber-400', borderColor: 'border-amber-500/20', features: ['Tudo do Growth', 'Inteligência de mercado', 'Viabilidade de negócio com IA', 'Gestão de equipe'] },
};

/** Plan tier order (lower index = lower tier). Used for upgrade vs downgrade label and comparison. */
const PLAN_TIER_ORDER: string[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

/** Feature comparison: keys match PlanConfig.key (FREE, BASIC, PRO, BUSINESS, SCALE). */
const FEATURE_MATRIX: Array<{ feature: string } & Record<string, boolean | string>> = [
    { feature: 'Busca por nicho e região', FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Score IA por lead', FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Histórico de buscas', FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Smart Tags nos leads', FREE: true, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Exportação CSV/JSON', FREE: false, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Activity Tracking', FREE: false, BASIC: true, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Análise de concorrência', FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Scripts de abordagem IA', FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Mensagem WhatsApp IA', FREE: false, BASIC: false, PRO: true, BUSINESS: true, SCALE: true },
    { feature: 'Inteligência de mercado', FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
    { feature: 'Viabilidade de negócio IA', FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
    { feature: 'Gestão de equipe', FREE: false, BASIC: false, PRO: false, BUSINESS: true, SCALE: true },
];

export default function PlanosPage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const { addToast } = useToast();
    const [plans, setPlans] = useState<PlanFromApi[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState<string | null>(null);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setPlansError(null);
        setPlansLoading(true);
        plansApi
            .list()
            .then((data) => {
                if (!cancelled) setPlans(data);
            })
            .catch((err: unknown) => {
                if (!cancelled) setPlansError(err instanceof Error ? err.message : 'Falha ao carregar planos.');
            })
            .finally(() => {
                if (!cancelled) setPlansLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const usagePercent = user.leadsLimit > 0
        ? Math.min(100, Math.round((user.leadsUsed / user.leadsLimit) * 100))
        : 0;

    const handleUpgrade = async (planId: string) => {
        if (planId === 'FREE' || planId === user.plan) return;
        setLoadingPlan(planId);
        try {
            const res = await billingApi.checkout({
                planId,
                locale: 'pt',
                scheduleAtPeriodEnd: isDowngrade(planId),
            });
            if (res.scheduled && res.url === null) {
                addToast('success', res.message);
                return;
            }
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao iniciar checkout.');
        } finally {
            setLoadingPlan(null);
        }
    };

    const formatPrice = (value: number) => (value === 0 ? 'R$ 0' : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);

    const planTierIndex = (planKey: string) => {
        const i = PLAN_TIER_ORDER.indexOf(planKey);
        return i >= 0 ? i : -1;
    };
    const isDowngrade = (targetKey: string) => planTierIndex(targetKey) < planTierIndex(user.plan);

    return (
        <>
            <HeaderDashboard title="Planos & Pagamentos" subtitle="Gerencie seu plano e histórico de cobrança." breadcrumb="Conta / Planos" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-8">

                {/* Current Plan & Credits */}
                <div className="rounded-3xl bg-card border border-border p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Seu Plano</h2>
                            <p className="text-sm text-muted mt-1">
                                Plano atual: <span className="text-violet-400 font-bold">{getPlanDisplayName(user.plan)}</span>
                            </p>
                            {user.plan !== 'FREE' && user.currentPeriodEnd && (
                                <p className="text-xs text-muted mt-1">
                                    Próxima renovação: {new Date(user.currentPeriodEnd).toLocaleDateString('pt-BR')}
                                </p>
                            )}
                            {user.plan !== 'FREE' && (
                                <p className="text-xs text-muted mt-2">
                                    O cartão cadastrado será utilizado para cobranças mensais de renovação. Você pode alterar ou cancelar na próxima renovação.
                                </p>
                            )}
                            {user.pendingPlanId && user.pendingPlanEffectiveAt && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
                                    Downgrade agendado: seu plano será alterado para {plans.find((p) => p.key === user.pendingPlanId)?.name ?? user.pendingPlanId} em {new Date(user.pendingPlanEffectiveAt).toLocaleDateString('pt-BR')}.
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-surface border border-border">
                            <Zap size={20} className="text-violet-400" />
                            <div>
                                <div className="text-lg font-bold text-foreground tabular-nums">{user.leadsUsed} / {user.leadsLimit}</div>
                                <div className="text-[10px] text-muted uppercase tracking-wider">Créditos Usados</div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-muted mb-2">
                            <span>Uso de créditos</span>
                            <span className="tabular-nums">{usagePercent}%</span>
                        </div>
                        <div className="w-full h-3 bg-surface rounded-full overflow-hidden border border-border">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${usagePercent}%`,
                                    background: usagePercent > 80
                                        ? 'linear-gradient(90deg, #ef4444, #f97316)'
                                        : 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Plans Grid (from API / PlanConfig) */}
                <div>
                    <h3 className="text-lg font-bold text-foreground mb-6 text-center">Planos Disponíveis</h3>
                    {plansLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 size={32} className="text-violet-400 animate-spin" />
                        </div>
                    ) : plansError ? (
                        <div className="rounded-3xl bg-card border border-border p-8 text-center">
                            <p className="text-muted mb-4">{plansError}</p>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setPlansError(null);
                                    setPlansLoading(true);
                                    plansApi.list().then(setPlans).catch((err: unknown) => setPlansError(err instanceof Error ? err.message : 'Falha ao carregar planos.')).finally(() => setPlansLoading(false));
                                }}
                                icon={<RefreshCw size={14} />}
                            >
                                Tentar novamente
                            </Button>
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">
                            Nenhum plano disponível no momento.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            {plans.map((plan) => {
                                const isCurrent = plan.key === user.plan;
                                const ui = PLAN_UI[plan.key] ?? { icon: Zap, color: 'text-muted', borderColor: 'border-border', features: [] };
                                const Icon = ui.icon;
                                const creditsLabel = `${plan.leadsLimit.toLocaleString('pt-BR')} créditos/mês`;
                                const features = [...ui.features, creditsLabel];
                                return (
                                    <div
                                        key={plan.key}
                                        className={`rounded-3xl border p-6 flex flex-col gap-4 transition-all relative ${ui.popular
                                            ? 'bg-gradient-to-b from-violet-900/30 to-card border-violet-500/40 shadow-lg shadow-violet-500/10'
                                            : `bg-card ${ui.borderColor}`
                                            } ${isCurrent ? 'ring-2 ring-violet-500' : ''}`}
                                    >
                                        {ui.popular && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                                                Popular
                                            </span>
                                        )}
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface border border-border">
                                                <Icon size={20} className={ui.color} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-foreground">{plan.name}</div>
                                                <div className="text-xs text-muted">{creditsLabel}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-foreground">{formatPrice(plan.priceMonthlyBrl)}</span>
                                            <span className="text-xs text-muted">/mês</span>
                                        </div>
                                        <ul className="text-xs text-muted space-y-2 flex-1">
                                            {features.map((f) => (
                                                <li key={`${plan.key}-feat-${f}`} className="flex items-start gap-2">
                                                    <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        {isCurrent ? (
                                            <div className="text-center text-xs font-bold text-violet-400 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                                Plano Atual
                                            </div>
                                        ) : plan.key === 'FREE' ? (
                                            <div className="text-center text-xs text-muted py-2">Plano gratuito</div>
                                        ) : (
                                            <Button
                                                variant={isDowngrade(plan.key) ? 'secondary' : 'primary'}
                                                size="sm"
                                                className="w-full rounded-xl font-bold"
                                                disabled={loadingPlan === plan.key}
                                                onClick={() => handleUpgrade(plan.key)}
                                                icon={loadingPlan === plan.key ? <Loader2 size={14} className="animate-spin" /> : isDowngrade(plan.key) ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                            >
                                                {loadingPlan === plan.key ? 'Processando...' : isDowngrade(plan.key) ? 'Downgrade' : 'Assinar'}
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Feature Comparison (dynamic from plans) */}
                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-bold text-foreground">Comparação Detalhada</h3>
                    </div>
                    {plans.length === 0 ? (
                        <div className="p-8 text-center text-muted text-sm">Carregue os planos para ver a comparação.</div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="py-3 px-5 text-left text-[10px] font-bold text-muted uppercase tracking-wider">Feature</th>
                                    {plans.map((plan) => (
                                        <th key={plan.key} className="py-3 px-4 text-center text-[10px] font-bold text-muted uppercase tracking-wider">
                                            {plan.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {FEATURE_MATRIX.map((row) => (
                                    <tr key={`row-${row.feature}`} className="border-b border-border/30 hover:bg-surface/30">
                                        <td className="py-2.5 px-5 text-xs text-foreground">{row.feature}</td>
                                        {plans.map((plan) => {
                                            const val = row[plan.key];
                                            return (
                                                <td key={plan.key} className="py-2.5 px-4 text-center">
                                                    {val === true ? (
                                                        <Check size={14} className="text-emerald-400 mx-auto" />
                                                    ) : val === false ? (
                                                        <span className="text-muted/30">—</span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-violet-400 tabular-nums">{String(val ?? '—')}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {plans.length > 0 && (
                                    <tr className="border-b border-border/30 hover:bg-surface/30">
                                        <td className="py-2.5 px-5 text-xs text-foreground">Créditos mensais</td>
                                        {plans.map((plan) => (
                                            <td key={plan.key} className="py-2.5 px-4 text-center">
                                                <span className="text-xs font-bold text-violet-400 tabular-nums">
                                                    {plan.leadsLimit.toLocaleString('pt-BR')}
                                                </span>
                                            </td>
                                        ))}
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>

                {/* Payment History Placeholder */}
                <div className="rounded-3xl bg-card border border-border p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-muted" /> Histórico de Pagamentos
                    </h3>
                    <div className="text-center py-8 text-muted">
                        <p className="text-sm">Nenhum pagamento registrado ainda.</p>
                        <p className="text-xs mt-1">Quando você assinar um plano pago, seus pagamentos aparecerão aqui.</p>
                        <p className="text-xs mt-3 text-muted/80">Pagamento com cartão: o valor será cobrado automaticamente todo mês para renovar seu plano até você cancelar ou alterar.</p>
                    </div>
                </div>
            </div>
        </>
    );
}
