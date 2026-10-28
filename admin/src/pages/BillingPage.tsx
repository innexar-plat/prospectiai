import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, PlayCircle, RefreshCw } from 'lucide-react';
import { adminApi, type BillingOverview, type BillingSubscription, type LifecycleReport } from '@/lib/api';
import { cn } from '@/lib/utils';

const PROVIDER_LABEL: Record<BillingSubscription['provider'], string> = {
  card_mp: 'Cartão (MP)',
  pix: 'PIX',
  stripe: 'Stripe',
  manual: 'Manual',
};

const STEP_LABEL: Record<string, string> = {
  trial_expired: 'Trials encerrados',
  trial_expiring_notice: 'Avisos de fim de trial',
  grace_expired: 'Carências encerradas',
  pending_plan_applied: 'Mudanças de plano aplicadas',
  credits_cycle_started: 'Ciclos de crédito iniciados',
  credits_reset: 'Créditos renovados',
  credits_expiring_notice: 'Avisos de créditos vencendo',
  pix_renewal_charge: 'PIX de renovação gerados',
  period_synced: 'Períodos sincronizados com o provedor',
  plan_expired: 'Planos expirados',
  reactivation_pix: 'PIX de reativação gerados',
};

type Filter = 'all' | 'paying' | 'expiring' | 'attention' | 'manual';

function money(value: number, currency: string): string {
  return value.toLocaleString(currency === 'USD' ? 'en-US' : 'pt-BR', { style: 'currency', currency });
}

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={cn('text-2xl font-bold mt-1 tabular-nums', tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-gray-900')}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function needsAttention(s: BillingSubscription): boolean {
  const d = daysUntil(s.currentPeriodEnd);
  return s.status === 'past_due' || (s.provider !== 'manual' && d != null && d < 0) || !!s.openPix;
}

export function BillingPage() {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('paying');
  const [report, setReport] = useState<LifecycleReport | null>(null);
  const [running, setRunning] = useState<'dry' | 'real' | null>(null);

  const load = useCallback(() => {
    adminApi.billing()
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (dryRun: boolean) => {
    if (!dryRun && !window.confirm('Executar o job de cobrança agora? Ele pode rebaixar planos, gerar cobranças PIX e enviar e-mails aos clientes.')) return;
    setRunning(dryRun ? 'dry' : 'real');
    try {
      setReport(await adminApi.runBillingLifecycle(dryRun));
      if (!dryRun) load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar');
    } finally {
      setRunning(null);
    }
  };

  const rows = useMemo(() => {
    const all = data?.subscriptions ?? [];
    switch (filter) {
      case 'paying': return all.filter((s) => s.provider !== 'manual' && s.status === 'active');
      case 'expiring': return all.filter((s) => { const d = daysUntil(s.currentPeriodEnd); return s.provider !== 'manual' && d != null && d >= 0 && d <= 7; });
      case 'attention': return all.filter(needsAttention);
      case 'manual': return all.filter((s) => s.provider === 'manual');
      default: return all;
    }
  }, [data, filter]);

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-6">Assinaturas e cobrança</h1>
        {error ? <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">{error}</div>
          : <div className="h-40 rounded-xl bg-gray-200 animate-pulse" />}
      </div>
    );
  }

  const s = data.summary;
  const revBrl = s.revenue30d.find((r) => r.currency === 'BRL');
  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'paying', label: 'Pagantes', count: s.paying },
    { key: 'expiring', label: 'Vencem em 7 dias', count: s.expiring7d },
    { key: 'attention', label: 'Precisam de atenção', count: data.subscriptions.filter(needsAttention).length },
    { key: 'manual', label: 'Concessões manuais', count: s.manualGrants },
    { key: 'all', label: 'Todos', count: data.subscriptions.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Assinaturas e cobrança</h1>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw size={14} aria-hidden /> Atualizar
          </button>
          <button type="button" onClick={() => run(true)} disabled={running != null} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            {running === 'dry' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlayCircle size={14} aria-hidden />} Simular job
          </button>
          <button type="button" onClick={() => run(false)} disabled={running != null} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {running === 'real' ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <PlayCircle size={14} aria-hidden />} Executar agora
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label="MRR" value={money(s.mrrBrl, 'BRL')} hint={s.mrrUsd > 0 ? `+ ${money(s.mrrUsd, 'USD')}` : 'assinaturas pagas'} />
        <Stat label="Recebido (30 dias)" value={money(revBrl?.amount ?? 0, 'BRL')} hint={`${revBrl?.payments ?? 0} pagamento(s)`} />
        <Stat label="Pagantes" value={s.paying} hint={`${s.byProvider.card_mp} cartão · ${s.byProvider.pix} PIX · ${s.byProvider.stripe} Stripe`} />
        <Stat label="Vencem em 7 dias" value={s.expiring7d} tone={s.expiring7d > 0 ? 'warn' : undefined} />
        <Stat label="PIX em aberto" value={s.openPix} hint="aguardando pagamento" />
        <Stat label="Em atraso" value={s.pastDue} tone={s.pastDue > 0 ? 'bad' : undefined} hint="em carência" />
      </div>

      {report && (
        <section className={cn('rounded-xl border p-4 text-sm', report.dryRun ? 'border-indigo-200 bg-indigo-50' : 'border-emerald-200 bg-emerald-50')}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">{report.dryRun ? 'Simulação — nada foi alterado' : 'Job executado'}</h2>
            <button type="button" onClick={() => setReport(null)} className="text-xs text-gray-500 hover:text-gray-700">Fechar</button>
          </div>
          {report.actions.length === 0 ? (
            <p className="mt-1 text-gray-600">Nenhuma ação necessária.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {Object.entries(report.counts).map(([step, n]) => (
                <li key={step}><strong>{n}</strong> · {STEP_LABEL[step] ?? step}</li>
              ))}
            </ul>
          )}
          {report.errors.length > 0 && (
            <ul className="mt-2 text-red-700 space-y-0.5">
              {report.errors.map((e, i) => <li key={i}>Erro em {STEP_LABEL[e.step] ?? e.step} ({e.workspaceId}): {e.detail}</li>)}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex gap-1 p-3 border-b border-gray-200 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn('px-3 py-1 rounded-lg text-xs font-medium', filter === f.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100')}
            >
              {f.label} <span className="opacity-70">({f.count})</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Plano</th>
                <th className="px-4 py-2.5 font-medium">Pagamento</th>
                <th className="px-4 py-2.5 font-medium">Vence em</th>
                <th className="px-4 py-2.5 font-medium">Créditos</th>
                <th className="px-4 py-2.5 font-medium">Observações</th>
                <th className="px-4 py-2.5 font-medium text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Nada por aqui.</td></tr>
              ) : rows.map((r) => {
                const d = daysUntil(r.currentPeriodEnd);
                const notes: string[] = [];
                if (r.status === 'past_due') notes.push(`em atraso até ${date(r.gracePeriodEnd)}`);
                if (r.status === 'canceled' && r.plan !== 'FREE') notes.push('cancelada (acesso até o fim do período)');
                if (r.pendingPlanId) notes.push(`muda para ${r.pendingPlanId} em ${date(r.pendingPlanEffectiveAt)}`);
                if (r.promoPaymentsRemaining) notes.push(`promo: ${r.promoPaymentsRemaining} cobrança(s)`);
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 align-top">
                    <td className="px-4 py-2.5">
                      <Link to={`../workspaces/${r.id}`} relative="path" className="font-medium text-gray-900 hover:text-indigo-600">{r.name ?? r.ownerName ?? r.id}</Link>
                      <div className="text-xs text-gray-500">{r.ownerEmail ?? '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{r.plan}<span className="text-xs text-gray-400"> · {r.billingCycle === 'annual' ? 'anual' : r.billingCycle === 'monthly' ? 'mensal' : '—'}</span></td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border', r.provider === 'manual' ? 'border-gray-200 text-gray-500' : 'border-indigo-200 text-indigo-700 bg-indigo-50')}>{PROVIDER_LABEL[r.provider]}</span>
                    </td>
                    <td className={cn('px-4 py-2.5 whitespace-nowrap', d != null && d < 0 ? 'text-red-600' : d != null && d <= 7 ? 'text-amber-700' : 'text-gray-700')}>
                      {date(r.currentPeriodEnd)}{d != null && <span className="text-xs text-gray-400"> ({d < 0 ? `${-d}d atrás` : `${d}d`})</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 tabular-nums whitespace-nowrap">
                      {r.leadsUsed} / {r.leadsLimit >= 100000 ? '∞' : r.leadsLimit}
                      {r.creditsResetAt && <div className="text-xs text-gray-400">renova {date(r.creditsResetAt)}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {r.openPix && (
                        <div>PIX em aberto até {date(r.openPix.expiresAt)}{r.openPix.url && <> · <a href={r.openPix.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">abrir</a></>}</div>
                      )}
                      {notes.map((n) => <div key={n}>{n}</div>)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-900">{r.provider === 'manual' ? '—' : money(r.mrr, r.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Receita por mês</h2>
          {data.revenueByMonth.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pagamento registrado ainda (o registro começou em 28/10/2026).</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.revenueByMonth.map((m) => (
                  <tr key={`${m.month}-${m.currency}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-gray-600">{m.month}</td>
                    <td className="py-1.5 text-gray-500 text-xs">{m.payments} pagamento(s)</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">{money(m.amount, m.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Últimos pagamentos</h2>
          {data.payments.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pagamento registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {data.payments.slice(0, 15).map((p) => (
                <li key={p.id} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="text-gray-600">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')} · {p.planId ?? '—'} · {p.method ?? p.provider} · {p.kind === 'RENEWAL' ? 'renovação' : 'nova assinatura'}
                    {p.status === 'REFUNDED' && <span className="text-red-600"> · estornado</span>}
                  </span>
                  <span className="font-medium tabular-nums">{money(p.amount, p.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
