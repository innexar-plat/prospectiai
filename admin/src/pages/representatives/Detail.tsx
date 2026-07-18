import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/lib/useConfirm';
import {
  representativesApi,
  type RepresentativeDetail,
  type CommissionItem,
  type GoalItem,
  type ClientItem,
  type AffiliateLinkItem,
  type RepLevel,
  type PayoutType,
  type CommissionStatus,
} from '@/lib/api/representatives';

type TabId = 'overview' | 'clients' | 'commissions' | 'goals' | 'affiliates' | 'config';

const levelBadge: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-gray-200 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-700',
  PLATINUM: 'bg-purple-100 text-purple-700',
};

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-200 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export function RepresentativesDetail() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabId>('overview');
  const [rep, setRep] = useState<RepresentativeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [commissionsTotal, setCommissionsTotal] = useState(0);
  const [commissionsOffset, setCommissionsOffset] = useState(0);
  const [commissionsStatusFilter, setCommissionsStatusFilter] = useState('');

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [clientsTotal, setClientsTotal] = useState(0);
  const [clientsOffset, setClientsOffset] = useState(0);

  const [affiliates, setAffiliates] = useState<AffiliateLinkItem[]>([]);
  const [affiliatesTotal, setAffiliatesTotal] = useState(0);
  const [affiliatesOffset, setAffiliatesOffset] = useState(0);
  const [affiliateLinkInput, setAffiliateLinkInput] = useState('');

  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [goalMonth, setGoalMonth] = useState(new Date().getMonth() + 1);
  const [goalYear, setGoalYear] = useState(new Date().getFullYear());
  const [goalTarget, setGoalTarget] = useState(0);

  const [saving, setSaving] = useState(false);
  const [payingCommissionId, setPayingCommissionId] = useState<string | null>(null);
  const [proofUrlForPay, setProofUrlForPay] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const COMM_PAGE_SIZE = 20;
  const CLI_PAGE_SIZE = 20;
  const AFF_PAGE_SIZE = 20;

  const fetchCommissions = useCallback(() => {
    if (!id) return;
    const params: { limit: number; offset: number; status?: string } = { limit: COMM_PAGE_SIZE, offset: commissionsOffset };
    if (commissionsStatusFilter) params.status = commissionsStatusFilter;
    representativesApi.getCommissions(id, params)
      .then((r) => { setCommissions(r.items); setCommissionsTotal(r.total); })
      .catch(() => {});
  }, [id, commissionsOffset, commissionsStatusFilter]);

  const fetchAffiliates = useCallback(() => {
    if (!id) return;
    representativesApi.getAffiliates(id, { limit: AFF_PAGE_SIZE, offset: affiliatesOffset })
      .then((r) => { setAffiliates(r.items); setAffiliatesTotal(r.total); })
      .catch(() => {});
  }, [id, affiliatesOffset]);

  const fetchGoals = useCallback(() => {
    if (!id) return;
    representativesApi.getGoals(id)
      .then((r) => {
        setGoals(r.items);
        const current = r.items.find((g) => g.month === goalMonth && g.year === goalYear);
        if (current) setGoalTarget(current.targetAmount / 100);
      })
      .catch(() => {});
  }, [id, goalMonth, goalYear]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      representativesApi.get(id).then(setRep),
      representativesApi.getCommissions(id, { limit: COMM_PAGE_SIZE, offset: 0 }).then((r) => { setCommissions(r.items); setCommissionsTotal(r.total); }),
      representativesApi.getClients(id, { limit: CLI_PAGE_SIZE, offset: 0 }).then((r) => { setClients(r.items); setClientsTotal(r.total); }),
      representativesApi.getAffiliates(id, { limit: AFF_PAGE_SIZE, offset: 0 }).then((r) => { setAffiliates(r.items); setAffiliatesTotal(r.total); }),
      representativesApi.getGoals(id).then((r) => { setGoals(r.items); const cur = r.items.find((g) => g.month === goalMonth && g.year === goalYear); if (cur) setGoalTarget(cur.targetAmount / 100); }),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id || !rep || saving) return;
    setSaving(true);
    try {
      const updated = await representativesApi.update(id, {
        level: rep.level,
        name: rep.name,
        email: rep.email,
        phone: rep.phone,
        document: rep.document,
        region: rep.region,
        creditsLimit: rep.creditsLimit,
        directCommissionPercent: rep.directCommissionPercent,
        affiliateOverridePercent: rep.affiliateOverridePercent,
        holdDays: rep.holdDays,
        payoutType: rep.payoutType,
        payoutPayload: rep.payoutPayload,
        minPayoutCents: rep.minPayoutCents,
        monthlyGoal: rep.monthlyGoal,
        notes: rep.notes,
        status: rep.status,
      });
      setRep(updated);
      showToast('success', 'Representante atualizado.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCommissionStatus = async (commissionId: string, status: CommissionStatus) => {
    const labels: Record<CommissionStatus, string> = { APPROVED: 'Aprovar', PAID: 'Pagar', CANCELLED: 'Cancelar', PENDING: 'Pendente' };
    const ok = await confirm({
      title: labels[status],
      message: `Confirmar ação "${labels[status]}" para esta comissão?`,
      confirmLabel: labels[status],
      variant: status === 'CANCELLED' ? 'danger' : 'primary',
    });
    if (!ok) return;
    setPayingCommissionId(commissionId);
    try {
      await representativesApi.updateCommissionStatus(commissionId, status, proofUrlForPay.trim() ? { paymentProofUrl: proofUrlForPay.trim() } : undefined);
      fetchCommissions();
      setProofUrlForPay('');
      showToast('success', `Comissão ${labels[status].toLowerCase()}.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro.');
    } finally {
      setPayingCommissionId(null);
    }
  };

  const handleSetGoal = async () => {
    if (!id) return;
    try {
      await representativesApi.setGoal(id, { month: goalMonth, year: goalYear, targetCents: Math.round(goalTarget * 100) });
      fetchGoals();
      showToast('success', 'Meta definida.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao definir meta.');
    }
  };

  const handleLinkAffiliate = async () => {
    if (!id || !affiliateLinkInput.trim()) return;
    try {
      await representativesApi.linkAffiliate(id, affiliateLinkInput.trim());
      setAffiliateLinkInput('');
      fetchAffiliates();
      showToast('success', 'Afiliado vinculado.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao vincular.');
    }
  };

  if (loading || !rep) {
    return (
      <div>
        <Link to=".." className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Representantes</Link>
        {error ? <div className="rounded-lg bg-red-50 text-red-600 px-4 py-3">{error}</div> : <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />}
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Visão Geral' },
    { id: 'clients', label: 'Clientes' },
    { id: 'commissions', label: 'Comissões' },
    { id: 'goals', label: 'Metas' },
    { id: 'affiliates', label: 'Afiliados' },
    { id: 'config', label: 'Config' },
  ];

  const copyLink = () => {
    const url = rep.disclosureLink;
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  return (
    <div>
      {ConfirmDialog}
      <Link to=".." className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Representantes</Link>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-xl font-semibold text-gray-900">{rep.name}</h1>
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[rep.status] ?? ''}`}>{rep.status}</span>
      </div>

      <nav className="border-b border-gray-200 mb-6" aria-label="Abas">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-violet-500 text-violet-700 bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-600',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Saldo</p>
              <p className="text-lg font-semibold text-gray-900">{rep.currency === 'USD' ? '$' : 'R$'} {((rep.balanceCents ?? 0) / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Comissões (Mês)</p>
              <p className="text-lg font-semibold text-gray-900">{rep.currency === 'USD' ? '$' : 'R$'} {((rep.currentMonthCommissionsCents ?? 0) / 100).toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Créditos</p>
              <p className="text-lg font-semibold text-gray-900">{rep.creditsUsed}/{rep.creditsLimit}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total de Registros</p>
              <p className="text-lg font-semibold text-gray-900">{rep._count.clients}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Cliques no Link</p>
              <p className="text-lg font-semibold text-gray-900">{rep.linkClicks ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Leads (sem plano pago)</p>
              <p className="text-lg font-semibold text-gray-900">{rep.leadsCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Clientes Ativos</p>
              <p className="text-lg font-semibold text-gray-900">{rep.activeClientsCount ?? 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Meta Mensal</p>
              {rep.monthlyGoal ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900">{rep.currency === 'USD' ? '$' : 'R$'} {(rep.monthlyGoal / 100).toFixed(2)}</p>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-violet-600 rounded-full h-2 transition-all"
                      style={{ width: `${Math.min(100, ((rep.monthlyGoalProgress ?? 0) / rep.monthlyGoal) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{((rep.monthlyGoalProgress ?? 0) / 100).toFixed(2)} / {(rep.monthlyGoal / 100).toFixed(2)}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma meta definida</p>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Link de Divulgação</p>
              {rep.disclosureLink ? (
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-600 truncate flex-1">{rep.disclosureLink}</code>
                  <button type="button" onClick={copyLink} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                    {copiedCode ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">—</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500">Nível</span><br /><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${levelBadge[rep.level] ?? ''}`}>{rep.level}</span></div>
              <div><span className="text-gray-500">Email</span><br /><span className="text-gray-700">{rep.email}</span></div>
              <div><span className="text-gray-500">Telefone</span><br /><span className="text-gray-700">{rep.phone ?? '—'}</span></div>
              <div><span className="text-gray-500">Documento</span><br /><span className="text-gray-700">{rep.document ?? '—'}</span></div>
              <div><span className="text-gray-500">Região</span><br /><span className="text-gray-700">{rep.region ?? '—'}</span></div>
              <div><span className="text-gray-500">Desde</span><br /><span className="text-gray-700">{new Date(rep.createdAt).toLocaleDateString('pt-BR')}</span></div>
              <div><span className="text-gray-500">Comissão Direta</span><br /><span className="text-gray-700">{rep.directCommissionPercent}%</span></div>
              <div><span className="text-gray-500">Override Afiliados</span><br /><span className="text-gray-700">{rep.affiliateOverridePercent}%</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <h2 className="px-4 py-3 font-medium text-gray-900 border-b border-gray-200">Clientes ({clientsTotal})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Plano</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhum cliente encontrado.</td></tr>
                  ) : clients.map((c) => (
                    <tr key={c.id} className="border-b border-gray-200">
                      <td className="px-4 py-3 text-gray-700">{c.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.plan ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.status ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{c.valueCents != null ? `${c.currency === 'USD' ? '$' : 'R$'} ${(c.valueCents / 100).toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {clientsTotal > CLI_PAGE_SIZE && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <button type="button" disabled={clientsOffset === 0} onClick={() => setClientsOffset((o) => Math.max(0, o - CLI_PAGE_SIZE))} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Anterior</button>
              <span>Página {Math.floor(clientsOffset / CLI_PAGE_SIZE) + 1} de {Math.ceil(clientsTotal / CLI_PAGE_SIZE)}</span>
              <button type="button" disabled={clientsOffset + CLI_PAGE_SIZE >= clientsTotal} onClick={() => setClientsOffset((o) => o + CLI_PAGE_SIZE)} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Próxima</button>
            </div>
          )}
        </div>
      )}

      {tab === 'commissions' && (
        <div>
          <div className="mb-4">
            <select
              value={commissionsStatusFilter}
              onChange={(e) => { setCommissionsStatusFilter(e.target.value); setCommissionsOffset(0); }}
              className="rounded border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm"
            >
              <option value="">Todos status</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="PAID">PAID</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <h2 className="px-4 py-3 font-medium text-gray-900 border-b border-gray-200">Comissões ({commissionsTotal})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="px-4 py-3 font-medium">Fonte</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">%</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Hold até</th>
                    <th className="px-4 py-3 font-medium">Pago em</th>
                    <th className="px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Nenhuma comissão encontrada.</td></tr>
                  ) : commissions.map((c) => (
                    <tr key={c.id} className="border-b border-gray-200">
                      <td className="px-4 py-3 text-gray-700">{c.source}</td>
                      <td className="px-4 py-3 text-gray-600">{c.clientName ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{c.currency === 'BRL' ? 'R$' : '$'} {(c.amountCents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{c.percent}%</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          c.status === 'PAID' && 'bg-green-100 text-green-700',
                          c.status === 'APPROVED' && 'bg-blue-100 text-blue-700',
                          c.status === 'PENDING' && 'bg-amber-100 text-amber-700',
                          c.status === 'CANCELLED' && 'bg-red-100 text-red-700',
                        )}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.holdUntil ? new Date(c.holdUntil).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {c.status === 'PENDING' && (
                            <button type="button" onClick={() => handleUpdateCommissionStatus(c.id, 'APPROVED')} disabled={payingCommissionId === c.id} className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50">
                              Aprovar
                            </button>
                          )}
                          {c.status === 'APPROVED' && (
                            payingCommissionId === c.id ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <input type="url" placeholder="URL comprovante" value={proofUrlForPay} onChange={(e) => setProofUrlForPay(e.target.value)} className="w-28 rounded border border-gray-300 bg-gray-100 px-1 py-1 text-xs" />
                                <button type="button" onClick={() => handleUpdateCommissionStatus(c.id, 'PAID')} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">Pagar</button>
                                <button type="button" onClick={() => { setPayingCommissionId(null); setProofUrlForPay(''); }} className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">X</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => { setPayingCommissionId(c.id); setProofUrlForPay(''); }} className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">Pagar</button>
                            )
                          )}
                          {(c.status === 'PENDING' || c.status === 'APPROVED') && (
                            <button type="button" onClick={() => handleUpdateCommissionStatus(c.id, 'CANCELLED')} disabled={payingCommissionId === c.id} className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {commissionsTotal > COMM_PAGE_SIZE && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <button type="button" disabled={commissionsOffset === 0} onClick={() => setCommissionsOffset((o) => Math.max(0, o - COMM_PAGE_SIZE))} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Anterior</button>
              <span>Página {Math.floor(commissionsOffset / COMM_PAGE_SIZE) + 1} de {Math.ceil(commissionsTotal / COMM_PAGE_SIZE)}</span>
              <button type="button" disabled={commissionsOffset + COMM_PAGE_SIZE >= commissionsTotal} onClick={() => setCommissionsOffset((o) => o + COMM_PAGE_SIZE)} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Próxima</button>
            </div>
          )}
        </div>
      )}

      {tab === 'goals' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-lg">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Definir Meta Mensal</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mês</label>
              <select value={goalMonth} onChange={(e) => setGoalMonth(parseInt(e.target.value, 10))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano</label>
              <select value={goalYear} onChange={(e) => setGoalYear(parseInt(e.target.value, 10))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Meta ({rep.currency === 'USD' ? '$' : 'R$'})</label>
              <input type="number" min={0} step="0.01" value={goalTarget} onChange={(e) => setGoalTarget(parseFloat(e.target.value) || 0)} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700" />
            </div>
          </div>
          <button type="button" onClick={handleSetGoal} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm">Salvar Meta</button>

          {goals.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Histórico de Metas</h3>
              <div className="space-y-2">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                    <span className="text-gray-600">{String(g.month).padStart(2, '0')}/{g.year}</span>
                    <span className="text-gray-900 font-medium">{rep.currency === 'USD' ? '$' : 'R$'} {(g.targetAmount / 100).toFixed(2)}</span>
                    {g.currentProgress != null && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className="bg-violet-600 rounded-full h-2" style={{ width: `${Math.min(100, g.targetAmount > 0 ? (g.currentProgress / g.targetAmount) * 100 : 0)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{((g.currentProgress ?? 0) / 100).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'affiliates' && (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="ID do afiliado para vincular..."
              value={affiliateLinkInput}
              onChange={(e) => setAffiliateLinkInput(e.target.value)}
              className="rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 w-64"
            />
            <button type="button" onClick={handleLinkAffiliate} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm">Vincular</button>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <h2 className="px-4 py-3 font-medium text-gray-900 border-b border-gray-200">Afiliados ({affiliatesTotal})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-left">
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Vinculado em</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliates.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Nenhum afiliado vinculado.</td></tr>
                  ) : affiliates.map((a) => (
                    <tr key={a.id} className="border-b border-gray-200">
                      <td className="px-4 py-3 text-gray-700">{a.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.email ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-violet-700 text-xs">{a.code ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{a.status ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(a.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {affiliatesTotal > AFF_PAGE_SIZE && (
            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <button type="button" disabled={affiliatesOffset === 0} onClick={() => setAffiliatesOffset((o) => Math.max(0, o - AFF_PAGE_SIZE))} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Anterior</button>
              <span>Página {Math.floor(affiliatesOffset / AFF_PAGE_SIZE) + 1} de {Math.ceil(affiliatesTotal / AFF_PAGE_SIZE)}</span>
              <button type="button" disabled={affiliatesOffset + AFF_PAGE_SIZE >= affiliatesTotal} onClick={() => setAffiliatesOffset((o) => o + AFF_PAGE_SIZE)} className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50">Próxima</button>
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-2xl">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Editar Representante</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="text-gray-500 block mb-1">Nome</label>
              <input value={rep.name} onChange={(e) => setRep({ ...rep, name: e.target.value })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Email</label>
              <input type="email" value={rep.email} onChange={(e) => setRep({ ...rep, email: e.target.value })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Telefone</label>
              <input value={rep.phone ?? ''} onChange={(e) => setRep({ ...rep, phone: e.target.value || null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Documento</label>
              <input value={rep.document ?? ''} onChange={(e) => setRep({ ...rep, document: e.target.value || null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Região</label>
              <input value={rep.region ?? ''} onChange={(e) => setRep({ ...rep, region: e.target.value || null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Nível</label>
              <select value={rep.level} onChange={(e) => setRep({ ...rep, level: e.target.value as RepLevel })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700">
                <option value="BRONZE">BRONZE</option>
                <option value="SILVER">SILVER</option>
                <option value="GOLD">GOLD</option>
                <option value="PLATINUM">PLATINUM</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Status</label>
              <select value={rep.status} onChange={(e) => setRep({ ...rep, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Créditos (limite)</label>
              <input type="number" min={0} value={rep.creditsLimit} onChange={(e) => setRep({ ...rep, creditsLimit: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">% Comissão Direta</label>
              <input type="number" min={0} max={100} value={rep.directCommissionPercent} onChange={(e) => setRep({ ...rep, directCommissionPercent: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">% Override Afiliados</label>
              <input type="number" min={0} max={100} value={rep.affiliateOverridePercent} onChange={(e) => setRep({ ...rep, affiliateOverridePercent: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Hold Days</label>
              <input type="number" min={0} value={rep.holdDays} onChange={(e) => setRep({ ...rep, holdDays: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Tipo Pagamento</label>
              <select value={rep.payoutType ?? ''} onChange={(e) => setRep({ ...rep, payoutType: (e.target.value || null) as PayoutType | null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700">
                <option value="">Selecione</option>
                <option value="PIX">PIX</option>
                <option value="BANK_TRANSFER">Transferência Bancária</option>
              </select>
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Chave/Dados</label>
              <input value={rep.payoutPayload ?? ''} onChange={(e) => setRep({ ...rep, payoutPayload: e.target.value || null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Valor Mínimo Saque (centavos)</label>
              <input type="number" min={0} value={rep.minPayoutCents} onChange={(e) => setRep({ ...rep, minPayoutCents: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
            <div>
              <label className="text-gray-500 block mb-1">Meta Mensal (centavos)</label>
              <input type="number" min={0} value={rep.monthlyGoal ?? ''} onChange={(e) => setRep({ ...rep, monthlyGoal: e.target.value ? parseInt(e.target.value, 10) : null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-gray-500 block text-sm mb-1">Notas</label>
            <textarea value={rep.notes ?? ''} onChange={(e) => setRep({ ...rep, notes: e.target.value || null })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700 text-sm" rows={3} />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
