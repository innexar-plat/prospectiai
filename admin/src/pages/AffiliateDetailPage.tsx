import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { adminApi, type AdminAffiliateDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

type TabId = 'overview' | 'referrals' | 'commissions';

function affiliateSignupLink(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/api/affiliate/click?ref=${encodeURIComponent(code)}`;
}

export function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabId>('overview');
  const [affiliate, setAffiliate] = useState<AdminAffiliateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [rate, setRate] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [payingCommissionId, setPayingCommissionId] = useState<string | null>(null);
  const [proofUrlForPay, setProofUrlForPay] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const isExternal = affiliate?.userId == null;

  const refetchAffiliate = useCallback(() => {
    if (!id) return;
    adminApi.affiliate(id).then((a) => {
      setAffiliate(a);
      setStatus(a.status);
      setRate(a.commissionRatePercent);
      setName(a.name ?? '');
      setEmail(a.email ?? '');
      setDocument((a as { document?: string }).document ?? '');
      setNotes((a as { notes?: string }).notes ?? '');
    }).catch(() => {});
  }, [id]);

  const copyLink = () => {
    if (!affiliate) return;
    const url = affiliateSignupLink(affiliate.code);
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleMarkCommissionPaid = async (commissionId: string, paymentProofUrl?: string) => {
    if (!id || payingCommissionId) return;
    setPayingCommissionId(commissionId);
    try {
      await adminApi.markCommissionPaid(id, commissionId, paymentProofUrl ?? undefined);
      refetchAffiliate();
      setProofUrlForPay('');
    } finally {
      setPayingCommissionId(null);
    }
  };

  const startPayFlow = (commissionId: string) => {
    setPayingCommissionId(commissionId);
    setProofUrlForPay('');
  };

  const cancelPayFlow = () => {
    setPayingCommissionId(null);
    setProofUrlForPay('');
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi
      .affiliate(id)
      .then((a) => {
        setAffiliate(a);
        setStatus(a.status);
        setRate(a.commissionRatePercent);
        setName(a.name ?? '');
        setEmail(a.email ?? '');
        setDocument((a as { document?: string }).document ?? '');
        setNotes((a as { notes?: string }).notes ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      const body: { status?: string; commissionRatePercent?: number; name?: string; email?: string; document?: string | null; notes?: string | null } = {
        status: status as 'PENDING' | 'APPROVED' | 'SUSPENDED',
        commissionRatePercent: rate,
      };
      if (isExternal) {
        body.name = name.trim() || undefined;
        body.email = email.trim() || undefined;
        body.document = document.trim() || null;
        body.notes = notes.trim() || null;
      }
      await adminApi.updateAffiliate(id, body);
      const a = await adminApi.affiliate(id);
      setAffiliate(a);
      setStatus(a.status);
      setRate(a.commissionRatePercent);
      setName(a.name ?? '');
      setEmail(a.email ?? '');
      setDocument((a as { document?: string }).document ?? '');
      setNotes((a as { notes?: string }).notes ?? '');
    } catch {
      setSaving(false);
    }
    setSaving(false);
  };

  if (loading || !affiliate) {
    return (
      <div>
        <Link to="/affiliates" className="text-sm text-zinc-400 hover:text-white mb-4 inline-block">← Afiliados</Link>
        {error ? <div className="rounded-lg bg-red-500/10 text-red-400 px-4 py-3">{error}</div> : <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />}
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'referrals', label: 'Referrals' },
    { id: 'commissions', label: 'Comissões' },
  ];

  return (
    <div>
      <Link to="/affiliates" className="text-sm text-zinc-400 hover:text-white mb-4 inline-block">← Afiliados</Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-xl font-semibold text-white">Afiliado: {affiliate.code}</h1>
        <button
          type="button"
          onClick={copyLink}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
        >
          {copiedLink ? 'Copiado' : 'Copiar link'}
        </button>
      </div>
      <nav className="border-b border-zinc-800 mb-6" aria-label="Abas">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                tab === t.id
                  ? 'border-violet-500 text-violet-300 bg-zinc-900'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'overview' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            {isExternal ? (
              <>
                <div><label className="text-zinc-500">Nome</label><br /><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 text-sm" /></div>
                <div><label className="text-zinc-500">Email</label><br /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 text-sm" /></div>
                <div><label className="text-zinc-500">Documento</label><br /><input value={document} onChange={(e) => setDocument(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 text-sm" /></div>
                <div><label className="text-zinc-500">Notas</label><br /><input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-200 text-sm" /></div>
              </>
            ) : (
              <>
                <div><span className="text-zinc-500">Nome</span><br /><span className="text-zinc-200">{affiliate.name ?? '—'}</span></div>
                <div><span className="text-zinc-500">Email</span><br /><span className="text-zinc-200">{affiliate.email ?? '—'}</span></div>
              </>
            )}
            <div><span className="text-zinc-500">Comissão pendente</span><br /><span className="text-zinc-200">R$ {((affiliate.commissionPendingCents ?? 0) / 100).toFixed(2)}</span></div>
            <div><span className="text-zinc-500">Comissão paga</span><br /><span className="text-zinc-200">R$ {((affiliate.commissionPaidCents ?? 0) / 100).toFixed(2)}</span></div>
          </div>
          <div className="border-t border-zinc-800 pt-4 mt-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Dados para pagamento</h3>
            {affiliate.payoutType && affiliate.payoutPayload ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-zinc-500">Tipo</span><br /><span className="text-zinc-200">{affiliate.payoutType === 'PIX' ? 'PIX' : 'Transferência bancária'}</span></div>
                <div className="col-span-2"><span className="text-zinc-500">Chave / Dados</span><br /><span className="text-zinc-200 break-all">{affiliate.payoutPayload}</span></div>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Não cadastrado</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <label className="text-zinc-400 text-sm">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-zinc-700 bg-zinc-800 text-zinc-200 px-3 py-2">
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
            <label className="text-zinc-400 text-sm ml-2">Taxa %</label>
            <input type="number" min={0} max={100} value={rate} onChange={(e) => setRate(parseInt(e.target.value, 10) || 0)} className="w-20 rounded border border-zinc-700 bg-zinc-800 text-zinc-200 px-3 py-2" />
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">Salvar</button>
          </div>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-white border-b border-zinc-800">Referrals ({affiliate.referrals?.length ?? 0})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Convertido</th><th className="px-4 py-3 font-medium">Valor</th></tr></thead>
              <tbody>
                {(affiliate.referrals ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800/50"><td className="px-4 py-3 text-zinc-300">{new Date(r.signupAt).toLocaleDateString('pt-BR')}</td><td className="px-4 py-3">{r.convertedAt ? 'Sim' : 'Não'}</td><td className="px-4 py-3">{r.valueCents != null ? `R$ ${(r.valueCents / 100).toFixed(2)}` : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <h2 className="px-4 py-3 font-medium text-white border-b border-zinc-800">Comissões ({affiliate.commissions?.length ?? 0})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="px-4 py-3 font-medium">Valor</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Criada</th><th className="px-4 py-3 font-medium">Pago em</th><th className="px-4 py-3 font-medium">Comprovante</th><th className="px-4 py-3 font-medium">Ação</th></tr></thead>
              <tbody>
                {(affiliate.commissions ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/50">
                    <td className="px-4 py-3 font-medium">{c.currency === 'BRL' ? 'R$' : '$'} {(c.amountCents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3">{c.status}</td>
                    <td className="px-4 py-3 text-zinc-300">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-4 py-3">
                      {c.paymentProofUrl ? (
                        <a href={c.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline text-xs break-all">Link</a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === 'APPROVED' ? (
                        payingCommissionId === c.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="url"
                              placeholder="URL do comprovante (opcional)"
                              value={proofUrlForPay}
                              onChange={(e) => setProofUrlForPay(e.target.value)}
                              className="min-w-[140px] max-w-[200px] rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                            />
                            <button type="button" onClick={() => handleMarkCommissionPaid(c.id, proofUrlForPay)} disabled={payingCommissionId !== c.id} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50">Confirmar</button>
                            <button type="button" onClick={cancelPayFlow} className="text-xs px-2 py-1 rounded bg-zinc-600 text-zinc-200">Cancelar</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => startPayFlow(c.id)} disabled={payingCommissionId !== null} className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50">Marcar como pago</button>
                        )
                      ) : c.status === 'PAID' ? '—' : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
