import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { representativesApi, type RepLevel, type PayoutType, type Market } from '@/lib/api/representatives';
import { adminApi } from '@/lib/api';
import { useToast } from '@/components/ui/ToastProvider';

export function RepresentativesCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingUserMatch, setExistingUserMatch] = useState<'checking' | 'found' | 'not_found' | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    region: '',
    market: 'BR' as Market,
    level: 'BRONZE' as RepLevel,
    creditsLimit: 100,
    directCommissionPercent: 10,
    affiliateOverridePercent: 5,
    holdDays: 30,
    payoutType: '' as PayoutType | '',
    payoutPayload: '',
    minPayoutCents: 10000,
    monthlyGoal: '',
    notes: '',
  });

  useEffect(() => {
    const email = form.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setExistingUserMatch(null);
      return;
    }
    let cancelled = false;
    setExistingUserMatch('checking');
    const timer = setTimeout(() => {
      adminApi.users({ search: email, limit: 5 })
        .then((res) => {
          if (cancelled) return;
          const match = res.items.some((u) => u.email?.toLowerCase() === email);
          setExistingUserMatch(match ? 'found' : 'not_found');
        })
        .catch(() => { if (!cancelled) setExistingUserMatch(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        market: form.market,
        level: form.level,
        creditsLimit: form.creditsLimit,
        directCommissionPercent: form.directCommissionPercent,
        affiliateOverridePercent: form.affiliateOverridePercent,
        holdDays: form.holdDays,
        minPayoutCents: form.minPayoutCents,
      };
      if (form.phone.trim()) body.phone = form.phone.trim();
      if (form.document.trim()) body.document = form.document.trim();
      if (form.region.trim()) body.region = form.region.trim();
      if (form.payoutType) body.payoutType = form.payoutType;
      if (form.payoutPayload.trim()) body.payoutPayload = form.payoutPayload.trim();
      if (form.monthlyGoal.trim()) body.monthlyGoal = parseInt(form.monthlyGoal, 10);
      if (form.notes.trim()) body.notes = form.notes.trim();
      const result = await representativesApi.create(body);
      showToast(
        'success',
        result.accountCreated
          ? 'Representante criado. Convite enviado por e-mail.'
          : 'Cliente existente promovido a representante.',
      );
      navigate('..');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar representante.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Link to=".." className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">← Representantes</Link>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo Representante</h2>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3 text-sm">{error}</div>
      )}
      <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Email *</label>
            <input required type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
            {existingUserMatch === 'found' && (
              <p className="mt-1 text-xs text-emerald-600">✓ Já é cliente Precision — a conta existente será promovida a representante (sem criar nova senha).</p>
            )}
            {existingUserMatch === 'not_found' && (
              <p className="mt-1 text-xs text-gray-500">Nenhuma conta encontrada — uma conta nova será criada e um convite será enviado por e-mail.</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Telefone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Documento (CPF/CNPJ)</label>
            <input value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Região</label>
            <input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Mercado *</label>
            <select value={form.market} onChange={(e) => setForm((f) => ({ ...f, market: e.target.value as Market }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
              <option value="BR">Brasil</option>
              <option value="US">Estados Unidos</option>
            </select>
            {existingUserMatch === 'found' && (
              <p className="mt-1 text-xs text-gray-500">Ignorado ao promover cliente existente — o mercado da conta atual dele é mantido.</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Nível *</label>
            <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value as RepLevel }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
              <option value="BRONZE">BRONZE</option>
              <option value="SILVER">SILVER</option>
              <option value="GOLD">GOLD</option>
              <option value="PLATINUM">PLATINUM</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Créditos (limite)</label>
            <input type="number" min={0} value={form.creditsLimit} onChange={(e) => setForm((f) => ({ ...f, creditsLimit: parseInt(e.target.value, 10) || 0 }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">% Comissão Direta</label>
            <input type="number" min={0} max={100} value={form.directCommissionPercent} onChange={(e) => setForm((f) => ({ ...f, directCommissionPercent: parseInt(e.target.value, 10) || 0 }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">% Override Afiliados</label>
            <input type="number" min={0} max={100} value={form.affiliateOverridePercent} onChange={(e) => setForm((f) => ({ ...f, affiliateOverridePercent: parseInt(e.target.value, 10) || 0 }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Hold Days</label>
            <input type="number" min={0} value={form.holdDays} onChange={(e) => setForm((f) => ({ ...f, holdDays: parseInt(e.target.value, 10) || 0 }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Tipo de Pagamento</label>
            <select value={form.payoutType} onChange={(e) => setForm((f) => ({ ...f, payoutType: e.target.value as PayoutType | '' }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700">
              <option value="">Selecione</option>
              <option value="PIX">PIX</option>
              <option value="BANK_TRANSFER">Transferência Bancária</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Chave/Dados de Pagamento</label>
            <input value={form.payoutPayload} onChange={(e) => setForm((f) => ({ ...f, payoutPayload: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Valor Mínimo de Saque (centavos)</label>
            <input type="number" min={0} value={form.minPayoutCents} onChange={(e) => setForm((f) => ({ ...f, minPayoutCents: parseInt(e.target.value, 10) || 0 }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
          <div>
            <label className="block text-sm text-gray-500 mb-1">Meta Mensal (centavos, opcional)</label>
            <input type="number" min={0} value={form.monthlyGoal} onChange={(e) => setForm((f) => ({ ...f, monthlyGoal: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-500 mb-1">Notas</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" rows={3} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">
            {submitting ? 'Criando…' : 'Criar Representante'}
          </button>
          <Link to=".." className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
