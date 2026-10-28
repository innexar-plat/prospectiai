import { lazy, Suspense, useEffect, useState } from 'react';
import { CreditCard, QrCode, X, Loader2 } from 'lucide-react';

/** Mercado Pago SDK (~heavy) only loads when the customer picks card. */
const CardForm = lazy(() => import('./MercadoPagoCardForm'));

export type BrPaymentChoice =
    | { paymentMethod: 'pix' }
    | { paymentMethod: 'card'; card_token_id: string };

interface PaymentMethodDialogProps {
    open: boolean;
    planName: string;
    amountBrl: number;
    cycleLabel: string;
    payerEmail: string;
    busy: boolean;
    onChoose: (choice: BrPaymentChoice) => void;
    onClose: () => void;
}

function formatBrl(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * BR checkout: credit card (recurring subscription, renews automatically) or PIX
 * (a new PIX charge is emailed before each renewal). No boleto / debit.
 */
export function PaymentMethodDialog({ open, planName, amountBrl, cycleLabel, payerEmail, busy, onChoose, onClose }: PaymentMethodDialogProps) {
    const [step, setStep] = useState<'choose' | 'card'>('choose');

    useEffect(() => {
        if (!open) return;
        setStep('choose');
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, busy, onClose]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="pay-method-title">
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-background shadow-xl">
                <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
                    <div>
                        <h2 id="pay-method-title" className="text-lg font-bold text-foreground">Como você quer pagar?</h2>
                        <p className="text-sm text-muted mt-0.5">
                            Plano {planName} · {formatBrl(amountBrl)} {cycleLabel}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface" aria-label="Fechar">
                        <X size={18} />
                    </button>
                </div>

                {step === 'choose' && (
                    <div className="p-5 space-y-3">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setStep('card')}
                            className="w-full flex items-start gap-3 p-4 rounded-xl border border-border hover:border-violet-500/50 hover:bg-surface text-left transition-colors"
                        >
                            <CreditCard className="mt-0.5 text-violet-600 dark:text-violet-400 shrink-0" size={22} />
                            <span>
                                <span className="block font-semibold text-foreground">Cartão de crédito</span>
                                <span className="block text-sm text-muted">Renovação automática todo ciclo. Cancele quando quiser.</span>
                            </span>
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => onChoose({ paymentMethod: 'pix' })}
                            className="w-full flex items-start gap-3 p-4 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-surface text-left transition-colors"
                        >
                            {busy ? <Loader2 className="mt-0.5 animate-spin shrink-0" size={22} /> : <QrCode className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" size={22} />}
                            <span>
                                <span className="block font-semibold text-foreground">PIX</span>
                                <span className="block text-sm text-muted">Aprovação na hora. Antes de cada renovação enviamos o novo PIX por e-mail.</span>
                            </span>
                        </button>
                        <p className="text-xs text-muted pt-1">
                            Os créditos do plano são mensais: o saldo não usado vence no fim de cada ciclo e é renovado no limite total.
                        </p>
                    </div>
                )}

                {step === 'card' && (
                    <div className="p-5">
                        <button type="button" onClick={() => setStep('choose')} disabled={busy} className="text-sm text-muted hover:text-foreground mb-3">
                            ← Outras formas de pagamento
                        </button>
                        <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm py-8 justify-center"><Loader2 className="animate-spin" size={16} /> Carregando pagamento seguro…</div>}>
                            <CardForm
                                amount={amountBrl}
                                payerEmail={payerEmail}
                                onToken={(token) => onChoose({ paymentMethod: 'card', card_token_id: token })}
                            />
                        </Suspense>
                    </div>
                )}
            </div>
        </div>
    );
}
