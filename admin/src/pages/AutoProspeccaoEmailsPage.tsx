import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Mail, MailOpen, RefreshCw, Send, ShieldCheck, UserX } from 'lucide-react';
import { adminApi, autoProspeccaoAdminApi, type AdminWorkspaceListItem, type AutoProspEmailStats } from '@/lib/api';
import { cn } from '@/lib/utils';

const DEFAULT_WORKSPACE = 'sys-workspace-precisionia';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Novos', ANALYZING: 'Analisando', SCORED: 'Com nota', HOT: 'Quentes', WARM: 'Mornos', COLD: 'Frios / descartados',
  EMAILING: 'Em sequência', CRM_SENT: 'Enviados ao CRM', ENGAGED: 'Engajados', CONVERTED: 'Clientes', BOUNCED: 'E-mail inválido', OPTED_OUT: 'Descadastrados',
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function Stat({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; icon: typeof Mail }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500"><Icon size={14} aria-hidden /> {label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

/** Cold outreach activity: who received what, who opened, opt-outs and today's warm-up budget. */
export function AutoProspeccaoEmailsPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceListItem[]>([]);
  const [workspaceId, setWorkspaceId] = useState(DEFAULT_WORKSPACE);
  const [data, setData] = useState<AutoProspEmailStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [previewStep, setPreviewStep] = useState(1);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => {
    adminApi.workspaces({ limit: 100 }).then((r) => setWorkspaces(r.items)).catch(() => { /* selector optional */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    autoProspeccaoAdminApi.emails.stats(workspaceId)
      .then((r) => { if (!cancelled) { setData(r.data); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    autoProspeccaoAdminApi.emails.preview(workspaceId, previewStep)
      .then((r) => { if (!cancelled) setPreview(r.data); })
      .catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [workspaceId, previewStep]);

  const s = data?.sender;
  const maxDaily = Math.max(1, ...(data?.daily.map((d) => d.sent) ?? [1]));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Envios e aberturas</h1>
          <p className="text-sm text-gray-500">E-mails da auto-prospecção: quem recebeu, quem abriu e quanto ainda sai hoje.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm"
            aria-label="Workspace"
          >
            <option value={DEFAULT_WORKSPACE}>PrecisionIA — Auto-Prospecção</option>
            {workspaces.filter((w) => w.id !== DEFAULT_WORKSPACE).map((w) => <option key={w.id} value={w.id}>{w.name ?? w.id}</option>)}
          </select>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50" aria-label="Atualizar">
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </header>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {s && (
        <section className={cn('rounded-xl border p-4 text-sm', s.active && s.mode !== 'none' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <strong className="text-gray-900">
              {!s.active ? 'Envio automático desligado' : s.mode === 'none' ? 'Sem remetente configurado' : s.mode === 'system' ? 'Enviando pelo e-mail principal' : 'Enviando pelo pool de remetentes'}
            </strong>
            {s.mode !== 'none' && <span className="text-gray-700">Hoje: <strong>{s.sentToday}</strong> de {s.dailyCap} ({s.remainingToday} restantes)</span>}
            {s.mode === 'system' && <span className="text-gray-700">Aquecimento desde: {s.startedAt ? new Date(s.startedAt).toLocaleDateString('pt-BR') : 'ainda não começou'}</span>}
            <span className="text-gray-700">{s.businessHoursNow ? 'Dentro do horário de envio' : 'Fora do horário (envia seg–sex, 9h–18h)'}</span>
            <Link to="/auto-prospeccao/config" className="ml-auto text-indigo-700 hover:underline">Configurar</Link>
          </div>
          {s.active && !s.replyTo && <p className="mt-2 text-amber-800">Defina um “Responder para” com uma caixa real — e-mail frio sem resposta possível é tratado como spam.</p>}
        </section>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat icon={Send} label="Enviados (7 dias)" value={data.totals.sent7d} hint={`${data.totals.sentTotal} no total`} />
            <Stat icon={MailOpen} label="Abertos (7 dias)" value={data.totals.opened7d} hint={data.totals.openRate7d == null ? 'sem envios' : `${data.totals.openRate7d}% de abertura`} />
            <Stat icon={Mail} label="Abertos (total)" value={data.totals.openedTotal} />
            <Stat icon={UserX} label="Descadastrados" value={data.totals.optedOut} />
            <Stat icon={ShieldCheck} label="E-mails inválidos" value={data.totals.bounced} hint="descartados antes do envio" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Envios por dia (14 dias)</h2>
              {data.daily.length === 0 ? <p className="text-sm text-gray-500">Nenhum envio no período.</p> : (
                <ul className="space-y-1.5">
                  {data.daily.map((d) => (
                    <li key={d.day} className="grid grid-cols-[56px_1fr_90px] items-center gap-2 text-xs">
                      <span className="tabular-nums text-gray-600">{d.day.slice(8)}/{d.day.slice(5, 7)}</span>
                      <span className="h-3 rounded bg-gray-100 overflow-hidden" aria-hidden>
                        <span className="block h-full rounded bg-indigo-500" style={{ width: `${(d.sent / maxDaily) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-gray-700">{d.sent} · {d.opened} abertos</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Leads por etapa</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {Object.entries(data.pipeline).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-gray-100 py-1">
                    <dt className="text-gray-600">{STATUS_LABELS[k] ?? k}</dt>
                    <dd className="font-semibold tabular-nums text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-semibold text-gray-700">Últimos e-mails enviados</h2>
            {data.recent.length === 0 ? <p className="px-5 py-4 text-sm text-gray-500">Nenhum e-mail enviado ainda.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500">
                      <th className="px-5 py-2 font-medium">Empresa</th>
                      <th className="px-3 py-2 font-medium">E-mail</th>
                      <th className="px-3 py-2 font-medium">Etapa</th>
                      <th className="px-3 py-2 font-medium">Assunto</th>
                      <th className="px-3 py-2 font-medium">Enviado</th>
                      <th className="px-3 py-2 font-medium">Aberto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((e) => (
                      <tr key={e.id} className="border-t border-gray-100">
                        <td className="px-5 py-2"><div className="font-medium text-gray-900">{e.company}</div><div className="text-xs text-gray-500">{e.city}</div></td>
                        <td className="px-3 py-2 text-gray-700">{e.email}</td>
                        <td className="px-3 py-2 tabular-nums">{e.step}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[260px] truncate" title={e.subject}>{e.subject}</td>
                        <td className="px-3 py-2 tabular-nums text-gray-700">{fmt(e.sentAt)}</td>
                        <td className="px-3 py-2">{e.openedAt ? <span className="text-emerald-700 font-medium">{fmt(e.openedAt)}</span> : <span className="text-gray-400">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700"><Eye size={16} className="text-gray-400" aria-hidden /> Como o e-mail chega</h2>
          <div className="ml-auto inline-flex rounded-lg border border-gray-200 p-0.5" role="group" aria-label="Etapa">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" onClick={() => setPreviewStep(n)} className={cn('px-3 py-1 text-xs font-medium rounded-md', n === previewStep ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                {n === 1 ? '1º contato' : n === 2 ? 'Follow-up' : 'Última tentativa'}
              </button>
            ))}
          </div>
        </div>
        {preview ? (
          <>
            <p className="mb-2 text-sm"><span className="text-gray-500">Assunto:</span> <strong>{preview.subject}</strong></p>
            <iframe title="Prévia do e-mail" sandbox="" srcDoc={preview.html} className="h-[520px] w-full rounded-lg border border-gray-200 bg-white" />
            <p className="mt-2 text-xs text-gray-500">Prévia com “Empresa Exemplo Ltda”. O rodapé de descadastro é inserido automaticamente em todo envio. <Link to="/auto-prospeccao/templates" className="text-indigo-700 hover:underline">Editar templates</Link></p>
          </>
        ) : <p className="text-sm text-gray-500">Carregando prévia…</p>}
      </section>
    </div>
  );
}
