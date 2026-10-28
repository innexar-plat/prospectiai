import { useEffect, useState } from 'react';
import { Activity, BrainCircuit, CalendarCheck, Filter, RefreshCw } from 'lucide-react';
import { adminApi, type RetentionReport } from '@/lib/api';
import { cn } from '@/lib/utils';

const COHORTS = [30, 90, 180] as const;

function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((part / total) * 100)}%`;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
        <Icon size={16} className="text-gray-400" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

/** Activation funnel for recent signups, weekly use of the sales routine and AI cost per call. */
export function RetentionPage() {
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<RetentionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminApi.retention(days)
      .then((r) => { if (!cancelled) { setData(r); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, reloadKey]);

  const f = data?.funnel;
  const steps = f ? [
    { label: 'Cadastros', value: f.signups },
    { label: 'Concluíram onboarding', value: f.onboarded },
    { label: 'Fizeram 1ª busca', value: f.searched },
    { label: 'Salvaram um lead', value: f.savedLead },
    { label: 'Registraram contato', value: f.contacted },
    { label: 'Pagantes', value: f.paid },
  ] : [];
  const maxAvgInput = Math.max(1, ...(data?.aiCost.map((d) => d.avgInput) ?? [1]));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retenção e ativação</h1>
          <p className="text-sm text-gray-500">Onde os novos clientes param, e se a rotina de vendas os traz de volta.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Período da coorte">
            {COHORTS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn('px-3 py-1 text-xs font-medium rounded-md', d === days ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50')}
              >
                {d} dias
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Atualizar">
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {f && (
        <Card title={`Funil de ativação — cadastros dos últimos ${days} dias`} icon={Filter}>
          <ol className="space-y-2">
            {steps.map((s, i) => {
              const prev = i === 0 ? s.value : steps[i - 1]!.value;
              const width = f.signups ? Math.max(2, (s.value / f.signups) * 100) : 0;
              return (
                <li key={s.label} className="grid grid-cols-[180px_1fr_110px] items-center gap-3 text-sm">
                  <span className="text-gray-700">{s.label}</span>
                  <span className="h-6 rounded bg-gray-100 overflow-hidden" aria-hidden>
                    <span className="block h-full rounded bg-indigo-500" style={{ width: `${width}%` }} />
                  </span>
                  <span className="text-right tabular-nums">
                    <strong className="text-gray-900">{s.value}</strong>
                    {i > 0 && <span className="ml-1.5 text-xs text-gray-500">{pct(s.value, prev)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-sm text-gray-600">
            <strong className="text-gray-900">Voltaram após 7 dias:</strong> {f.returnedAfter7d} de {f.eligibleForReturn} ({pct(f.returnedAfter7d, f.eligibleForReturn)}) — buscaram de novo uma semana ou mais depois do cadastro.
          </p>
        </Card>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Rotina de vendas — últimos 7 dias" icon={CalendarCheck}>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Usuários buscando" value={data.weekly.activeSearchers} />
              <Stat label="Contatos registrados" value={data.weekly.contactsLogged} hint={`${data.weekly.usersContacting} usuário(s)`} />
              <Stat label="Follow-ups agendados" value={data.weekly.followUpsScheduled} />
              <Stat label="Follow-ups atrasados" value={data.weekly.followUpsOverdue} />
            </div>
          </Card>

          <Card title="Custo de IA por chamada — 14 dias" icon={BrainCircuit}>
            {data.aiCost.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma chamada de IA no período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">Dia</th>
                    <th className="pb-2 font-medium text-right">Chamadas</th>
                    <th className="pb-2 font-medium pl-4">Entrada média (tokens)</th>
                    <th className="pb-2 font-medium text-right">Saída média</th>
                  </tr>
                </thead>
                <tbody>
                  {data.aiCost.map((d) => (
                    <tr key={d.day} className="border-t border-gray-100">
                      <td className="py-1.5 tabular-nums text-gray-700">{d.day.slice(5).split('-').reverse().join('/')}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.calls}</td>
                      <td className="py-1.5 pl-4">
                        <span className="flex items-center gap-2">
                          <span className="h-2 rounded bg-indigo-400" style={{ width: `${(d.avgInput / maxAvgInput) * 100}px` }} aria-hidden />
                          <span className="tabular-nums">{d.avgInput.toLocaleString('pt-BR')}</span>
                        </span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{d.avgOutput.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
