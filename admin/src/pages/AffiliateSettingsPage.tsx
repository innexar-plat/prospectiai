import { useEffect, useState } from 'react';
import { adminApi, type AffiliateSettingsPublic, type AffiliateSettingsUpdateBody } from '@/lib/api';
import { Save } from 'lucide-react';

export function AffiliateSettingsPage() {
  const [config, setConfig] = useState<AffiliateSettingsPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState<AffiliateSettingsUpdateBody>({
    defaultCommissionRatePercent: 20,
    cookieDurationDays: 30,
    commissionRule: 'FIRST_PAYMENT_ONLY',
    approvalHoldDays: 15,
    minPayoutCents: 10000,
    allowSelfSignup: true,
  });

  const loadConfig = () => {
    setLoading(true);
    adminApi.affiliateSettings
      .get()
      .then((data) => {
        setConfig(data);
        setForm({
          defaultCommissionRatePercent: data.defaultCommissionRatePercent,
          cookieDurationDays: data.cookieDurationDays,
          commissionRule: data.commissionRule as 'FIRST_PAYMENT_ONLY' | 'RECURRING',
          approvalHoldDays: data.approvalHoldDays,
          minPayoutCents: data.minPayoutCents,
          allowSelfSignup: data.allowSelfSignup,
        });
      })
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const updated = await adminApi.affiliateSettings.update(form);
      setConfig(updated);
      setToast({ type: 'success', message: 'Configurações salvas.' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Configurações de Afiliados</h1>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Configurações de Afiliados</h1>
      {toast && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
        >
          {toast.message}
        </div>
      )}
      <form onSubmit={handleSave} className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Taxa de comissão padrão (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.defaultCommissionRatePercent ?? 20}
            onChange={(e) => setForm((f) => ({ ...f, defaultCommissionRatePercent: parseInt(e.target.value, 10) || 0 }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Duração do cookie (dias)</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.cookieDurationDays ?? 30}
            onChange={(e) => setForm((f) => ({ ...f, cookieDurationDays: parseInt(e.target.value, 10) || 1 }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Regra de comissão</label>
          <select
            value={form.commissionRule ?? 'FIRST_PAYMENT_ONLY'}
            onChange={(e) => setForm((f) => ({ ...f, commissionRule: e.target.value as 'FIRST_PAYMENT_ONLY' | 'RECURRING' }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200"
          >
            <option value="FIRST_PAYMENT_ONLY">Apenas primeira compra</option>
            <option value="RECURRING">Primeira compra + recorrente</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Dias de hold para aprovação</label>
          <input
            type="number"
            min={0}
            max={365}
            value={form.approvalHoldDays ?? 15}
            onChange={(e) => setForm((f) => ({ ...f, approvalHoldDays: parseInt(e.target.value, 10) || 0 }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">Mínimo para saque (centavos)</label>
          <input
            type="number"
            min={0}
            value={form.minPayoutCents ?? 10000}
            onChange={(e) => setForm((f) => ({ ...f, minPayoutCents: parseInt(e.target.value, 10) || 0 }))}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-200"
          />
          <p className="text-xs text-zinc-500 mt-1">Ex.: 10000 = R$ 100,00</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowSelfSignup"
            checked={form.allowSelfSignup ?? true}
            onChange={(e) => setForm((f) => ({ ...f, allowSelfSignup: e.target.checked }))}
            className="rounded border-zinc-600 bg-zinc-800"
          />
          <label htmlFor="allowSelfSignup" className="text-sm text-zinc-300">
            Permitir auto-cadastro como afiliado
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </div>
  );
}
