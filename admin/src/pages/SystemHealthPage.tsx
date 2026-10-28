import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, RefreshCw, Server, Webhook, XCircle, Zap } from 'lucide-react';
import { adminApi, type CronStatus, type SystemHealth } from '@/lib/api';
import { cn } from '@/lib/utils';

const REFRESH_MS = 30_000;

function formatAgo(iso?: string | null): string {
  if (!iso) return 'nunca';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  const mb = bytes / 1048576;
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', ok ? (warn ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500')}
      aria-hidden
    />
  );
}

function Card({ title, icon: Icon, children, className }: { title: string; icon: typeof Activity; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl border border-gray-200 bg-white p-5 shadow-sm', className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
        <Icon size={16} className="text-gray-400" aria-hidden /> {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, ok, warn }: { label: string; value: React.ReactNode; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-gray-100 last:border-0">
      <span className="flex items-center gap-2 text-gray-600">
        {ok !== undefined && <StatusDot ok={ok} warn={warn} />}
        {label}
      </span>
      <span className="text-gray-900 font-medium text-right tabular-nums">{value}</span>
    </div>
  );
}

function CronRow({ cron }: { cron: CronStatus }) {
  const failed = cron.last && !cron.last.ok;
  const ok = cron.scheduled ? !cron.stale && !failed : !failed;
  return (
    <tr className="border-b border-gray-100 last:border-0 align-top">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <StatusDot ok={ok} warn={!cron.scheduled} />
          <span className="text-gray-900">{cron.label}</span>
        </div>
        <div className="text-[11px] text-gray-400 ml-4.5 pl-[18px]">{cron.name}</div>
      </td>
      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">
        {cron.scheduled ? (cron.intervalMin >= 1440 ? `${cron.intervalMin / 1440}× dia` : `a cada ${cron.intervalMin} min`) : <span className="text-amber-700">não agendado</span>}
      </td>
      <td className="py-2 pr-3 text-gray-600 whitespace-nowrap">{formatAgo(cron.last?.at)}</td>
      <td className="py-2 text-xs text-gray-500 max-w-[22rem]">
        {cron.last ? (
          <span className={cn(failed && 'text-red-600')}>
            {failed ? 'Falhou' : 'OK'} · {Math.round((cron.last.durationMs ?? 0) / 100) / 10}s
            {cron.last.summary ? <span className="block truncate" title={cron.last.summary}>{cron.last.summary}</span> : null}
          </span>
        ) : '—'}
      </td>
    </tr>
  );
}

function ErrorBars({ perHour }: { perHour: SystemHealth['errors']['perHour'] }) {
  const max = Math.max(1, ...perHour.map((p) => p.count));
  return (
    <div className="flex items-end gap-[3px] h-16" role="img" aria-label="Erros por hora nas últimas 24 horas">
      {perHour.map((p) => (
        <div
          key={p.hour}
          title={`${p.hour.slice(11, 13)}h — ${p.count} erro(s)`}
          className={cn('flex-1 rounded-sm min-h-[2px]', p.count > 0 ? 'bg-red-400' : 'bg-gray-200')}
          style={{ height: `${Math.max(3, (p.count / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

const STATUS_STYLE = {
  ok: { label: 'Tudo funcionando', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
  degraded: { label: 'Atenção necessária', className: 'border-amber-200 bg-amber-50 text-amber-800', Icon: AlertTriangle },
  down: { label: 'Sistema com falha', className: 'border-red-200 bg-red-50 text-red-800', Icon: XCircle },
} as const;

export function SystemHealthPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.systemHealth()
      .then((d) => { setData(d); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (!data) {
    return (
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-6">Saúde do sistema</h1>
        {error ? (
          <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-xl bg-gray-200 animate-pulse" />)}
          </div>
        )}
      </div>
    );
  }

  const st = STATUS_STYLE[data.status];
  const integ = data.integrations;
  const errors24h = data.errors.perHour.reduce((a, p) => a + p.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">Saúde do sistema</h1>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} aria-hidden />
          Atualizar · {new Date(data.checkedAt).toLocaleTimeString('pt-BR')}
        </button>
      </div>

      <div className={cn('rounded-xl border px-5 py-4', st.className)}>
        <div className="flex items-center gap-2 font-semibold">
          <st.Icon size={18} aria-hidden /> {st.label}
        </div>
        {data.problems.length > 0 && (
          <ul className="mt-2 text-sm list-disc pl-6 space-y-0.5">
            {data.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Infraestrutura" icon={Server}>
          <Row label="Banco de dados" ok={data.db.ok} value={data.db.ok ? `${data.db.latencyMs} ms` : 'fora do ar'} />
          <Row label="Tamanho do banco" value={formatBytes(data.db.detail?.sizeBytes)} />
          <Row label="Conexões (ativas)" value={`${data.db.detail?.connections ?? '—'} (${data.db.detail?.activeConnections ?? '—'})`} />
          <Row label="Redis" ok={data.redis.ok} value={data.redis.ok ? `${data.redis.latencyMs} ms` : 'fora do ar'} />
          <Row label="Memória do Redis" value={`${data.redis.detail?.usedMemory ?? '—'} / ${data.redis.detail?.maxMemory || 'sem limite'}`} />
          <Row label="Chaves descartadas" ok={(data.redis.detail?.evictedKeys ?? 0) === 0} warn={(data.redis.detail?.evictedKeys ?? 0) > 0} value={data.redis.detail?.evictedKeys ?? 0} />
          <Row label="Backend no ar há" value={formatUptime(data.app.uptimeSec)} />
          <Row label="Memória do backend" value={`${data.app.memory.rssMb} MB`} />
          <Row label="Última migration" value={<span className="text-xs">{data.db.detail?.lastMigration ?? '—'}</span>} />
        </Card>

        <Card title="Integrações" icon={Zap}>
          <Row label={`E-mail · ${integ.email.provider}`} ok={integ.email.ok} warn={!!integ.email.note} value={integ.email.note ? <span className="text-xs text-amber-700">{integ.email.note}</span> : 'OK'} />
          <Row label="Mercado Pago" ok={integ.mercadoPago.ok} value={integ.mercadoPago.ok ? 'OK' : !integ.mercadoPago.token ? 'sem token' : 'sem segredo do webhook'} />
          <Row label="Stripe (EUA)" ok warn={!integ.stripe.ok} value={integ.stripe.ok ? 'OK' : 'não configurado'} />
          <Row label="Google Places" ok={integ.googlePlaces.ok} value={integ.googlePlaces.ok ? 'OK' : 'sem chave'} />
          <Row label="Busca web (Serper)" ok={integ.serper.ok} value={integ.serper.ok ? 'OK' : 'sem chave'} />
          <Row label="IA" ok={integ.ai.ok} value={integ.ai.configured.length > 0 ? `${integ.ai.configured.length} papel(is) no painel` : integ.ai.ok ? 'via ambiente' : 'nenhum'} />
          <Row label="Login com Google" ok warn={!integ.googleLogin.ok} value={integ.googleLogin.ok ? 'OK' : 'desativado'} />
          <Row label="Alertas no Telegram" ok warn={!integ.telegram.ok} value={integ.telegram.ok ? 'OK' : 'desativado'} />
          <Row label="Segredo dos crons" ok={integ.cronSecret.ok} value={integ.cronSecret.ok ? 'OK' : 'ausente'} />
        </Card>

        <Card title="Últimas 24 horas" icon={Activity}>
          <Row label="Novos cadastros" value={data.usage?.signups ?? '—'} />
          <Row label="Buscas" value={data.usage?.searches ?? '—'} />
          <Row label="Análises de IA" value={data.usage?.analyses ?? '—'} />
          <Row label="Chamadas Google Places" value={(data.usage?.byType.GOOGLE_PLACES_SEARCH ?? 0) + (data.usage?.byType.GOOGLE_PLACES_DETAILS ?? 0)} />
          <Row label="Chamadas Serper" value={data.usage?.byType.SERPER_REQUEST ?? 0} />
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Erros por hora</span>
              <span className={cn('font-semibold', errors24h > 0 ? 'text-red-600' : 'text-gray-500')}>{errors24h} no total</span>
            </div>
            <ErrorBars perHour={data.errors.perHour} />
          </div>
        </Card>
      </div>

      <Card title="Rotinas agendadas (crons)" icon={Clock}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="pb-2 pr-3 font-medium">Rotina</th>
                <th className="pb-2 pr-3 font-medium">Frequência</th>
                <th className="pb-2 pr-3 font-medium">Última execução</th>
                <th className="pb-2 font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {data.crons.map((c) => <CronRow key={c.name} cron={c} />)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          O registro de execuções começou com esta versão; rotinas que ainda não rodaram aparecem como “nunca”.
          “Não agendado” = a rotina existe no sistema, mas não há agendamento no servidor.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Pagamentos e cobrança" icon={Database}>
          {data.billing ? (
            <>
              <Row label="Planos pagos vencidos sem processar" ok={data.billing.paidPlansPastPeriod === 0} value={data.billing.paidPlansPastPeriod} />
              <Row label="Mudanças de plano atrasadas" ok={data.billing.overduePlanChanges === 0} value={data.billing.overduePlanChanges} />
              <Row label="Em atraso (carência)" ok={data.billing.pastDue === 0} warn={data.billing.pastDue > 0} value={data.billing.pastDue} />
              <Row label="PIX de renovação em aberto" value={data.billing.openPixCharges} />
              <Row label="Contas acima do limite de créditos" ok={data.billing.workspacesOverLimit === 0} warn={data.billing.workspacesOverLimit > 0} value={data.billing.workspacesOverLimit} />
            </>
          ) : <p className="text-sm text-gray-500">Indisponível (banco fora do ar).</p>}
        </Card>

        <Card title="Webhooks de pagamento" icon={Webhook}>
          {Object.entries(data.webhooks).map(([provider, w]) => (
            <div key={provider} className="py-1.5 border-b border-gray-100 last:border-0">
              <Row
                label={provider === 'mercadopago' ? 'Mercado Pago' : 'Stripe'}
                ok={!w.lastErrorAt || (w.lastOkAt != null && w.lastOkAt > w.lastErrorAt)}
                value={`último ${formatAgo(w.lastAt)}`}
              />
              {w.lastErrorAt && (
                <p className="text-xs text-red-600 pl-[18px]">Último erro {formatAgo(w.lastErrorAt)}: {w.lastError}</p>
              )}
            </div>
          ))}
          <p className="mt-2 text-xs text-gray-500">Registrado a partir desta versão.</p>
        </Card>
      </div>

      <Card title="Erros recentes" icon={AlertTriangle}>
        {data.errors.recent.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum erro registrado.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {data.errors.recent.map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-2 flex gap-3">
                <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">{new Date(e.at).toLocaleString('pt-BR')}</span>
                <span className="text-gray-800 break-words min-w-0">{e.message}{e.route ? <span className="text-gray-400"> · {e.route}</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
