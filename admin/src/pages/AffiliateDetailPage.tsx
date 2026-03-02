import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, type AdminAffiliateDetail } from '@/lib/api';

export function AffiliateDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  const isExternal = affiliate?.userId == null;

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
        <Link to="affiliates" className="text-sm text-zinc-400 hover:text-white mb-4 inline-block">← Afiliados</Link>
        {error ? <div className="rounded-lg bg-red-500/10 text-red-400 px-4 py-3">{error}</div> : <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />}
      </div>
    );
  }

  return (
    <div>
      <Link to="affiliates" className="text-sm text-zinc-400 hover:text-white mb-4 inline-block">← Afiliados</Link>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 mb-6">
        <h1 className="text-xl font-semibold text-white mb-4">Afiliado: {affiliate.code}</h1>
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
        <div className="flex flex-wrap items-center gap-4">
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
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden mb-6">
        <h2 className="px-4 py-3 font-medium text-white border-b border-zinc-800">Referrals ({affiliate.referrals?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="px-4 py-2">Data</th><th className="px-4 py-2">Convertido</th><th className="px-4 py-2">Valor</th></tr></thead>
            <tbody>
              {(affiliate.referrals ?? []).map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50"><td className="px-4 py-2 text-zinc-300">{new Date(r.signupAt).toLocaleDateString('pt-BR')}</td><td className="px-4 py-2">{r.convertedAt ? 'Sim' : 'Não'}</td><td className="px-4 py-2">{r.valueCents != null ? `R$ ${(r.valueCents / 100).toFixed(2)}` : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <h2 className="px-4 py-3 font-medium text-white border-b border-zinc-800">Comissões ({affiliate.commissions?.length ?? 0})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-800 text-zinc-500 text-left"><th className="px-4 py-2">Valor</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Criada</th><th className="px-4 py-2">Pago em</th></tr></thead>
            <tbody>
              {(affiliate.commissions ?? []).map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/50"><td className="px-4 py-2 font-medium">{c.currency === 'BRL' ? 'R$' : '$'} {(c.amountCents / 100).toFixed(2)}</td><td className="px-4 py-2">{c.status}</td><td className="px-4 py-2 text-zinc-300">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td><td className="px-4 py-2">{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
