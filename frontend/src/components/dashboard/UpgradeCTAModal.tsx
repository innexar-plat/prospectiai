import { createPortal } from 'react-dom';
import { Rocket, ArrowRight, Zap, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getNextUpgradePlan, getPlanDisplayName } from '@/lib/billing-config';

interface UpgradeCTAModalProps {
    currentPlan: string;
    leadsUsed: number;
    leadsLimit: number;
    onClose: () => void;
}

export function UpgradeCTAModal({ currentPlan, leadsUsed, leadsLimit, onClose }: UpgradeCTAModalProps) {
    const next = getNextUpgradePlan(currentPlan);
    if (!next) return null;

    const formatPrice = (v: number) => v === 0 ? 'R$ 0' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 10001 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-cta-title"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative rounded-2xl border border-violet-500/30 bg-card shadow-2xl shadow-violet-500/10 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Gradient header */}
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-5 text-white relative">
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/20 transition-colors"
                        aria-label="Fechar"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Zap size={22} className="text-white" />
                        </div>
                        <div>
                            <h2 id="upgrade-cta-title" className="text-lg font-bold">Seus créditos acabaram!</h2>
                            <p className="text-sm text-white/80">{leadsUsed}/{leadsLimit} créditos utilizados</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-muted">
                        Você está no plano <span className="font-bold text-foreground">{getPlanDisplayName(currentPlan)}</span> e
                        já usou todos os seus créditos deste mês.
                    </p>

                    {/* Next plan highlight */}
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-violet-600/20 flex items-center justify-center">
                                <Rocket size={18} className="text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="font-bold text-foreground">Plano {next.name}</p>
                                <p className="text-xs text-muted">{next.leadsLimit.toLocaleString('pt-BR')} créditos/mês</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-lg font-black text-violet-600 dark:text-violet-400">{formatPrice(next.priceBrl)}</p>
                                <p className="text-[10px] text-muted">/mês</p>
                            </div>
                        </div>
                        <ul className="text-xs text-muted space-y-1.5">
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                {next.leadsLimit / (leadsLimit || 1)}x mais créditos que seu plano atual
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                Acesso imediato após upgrade
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                                Créditos reiniciam ao fazer upgrade
                            </li>
                        </ul>
                    </div>

                    {/* CTA buttons */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
                        >
                            Depois
                        </button>
                        <Link
                            to="/dashboard/planos"
                            onClick={onClose}
                            className="flex-[2] px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold text-center transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25"
                        >
                            Fazer upgrade
                            <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
