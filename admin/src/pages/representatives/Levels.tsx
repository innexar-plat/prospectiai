import { useCallback, useEffect, useState } from 'react';
import { representativesApi, type LevelConfig, type RepLevel } from '@/lib/api/representatives';

const levelLabels: Record<RepLevel, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

const levelColors: Record<RepLevel, string> = {
  BRONZE: 'border-amber-400 bg-amber-50',
  SILVER: 'border-gray-400 bg-gray-50',
  GOLD: 'border-yellow-400 bg-yellow-50',
  PLATINUM: 'border-purple-400 bg-purple-50',
};

export function RepLevels() {
  const [configs, setConfigs] = useState<LevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RepLevel | null>(null);
  const [editForm, setEditForm] = useState<LevelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    representativesApi.getLevelConfigs()
      .then((res) => setConfigs(res.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (config: LevelConfig) => {
    setEditing(config.level);
    setEditForm({ ...config });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm || saving) return;
    setSaving(true);
    try {
      await representativesApi.updateLevelConfig(editForm.level, editForm);
      setToast({ type: 'success', message: `Nível ${levelLabels[editForm.level]} atualizado.` });
      setTimeout(() => setToast(null), 5000);
      setEditing(null);
      setEditForm(null);
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar.' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (loading && configs.length === 0) {
    return (
      <div>
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && configs.length === 0) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <div>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(configs.length > 0 ? configs : Object.keys(levelLabels).map((l) => ({ level: l as RepLevel, directCommissionPercent: 0, affiliateOverridePercent: 0, creditsLimit: 0, minPayoutCents: 0, monthlyGoal: 0 } as LevelConfig))).map((config) => {
          const isEditing = editing === config.level;
          return (
            <div key={config.level} className={`rounded-xl border-2 ${levelColors[config.level]} bg-white p-5 shadow-sm`}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{levelLabels[config.level]}</h3>
              {isEditing && editForm ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs text-gray-500">% Comissão Direta</label>
                    <input type="number" min={0} max={100} value={editForm.directCommissionPercent} onChange={(e) => setEditForm({ ...editForm, directCommissionPercent: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">% Override</label>
                    <input type="number" min={0} max={100} value={editForm.affiliateOverridePercent} onChange={(e) => setEditForm({ ...editForm, affiliateOverridePercent: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Créditos</label>
                    <input type="number" min={0} value={editForm.creditsLimit} onChange={(e) => setEditForm({ ...editForm, creditsLimit: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Saque Mínimo (centavos)</label>
                    <input type="number" min={0} value={editForm.minPayoutCents} onChange={(e) => setEditForm({ ...editForm, minPayoutCents: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Meta Mensal (centavos)</label>
                    <input type="number" min={0} value={editForm.monthlyGoal} onChange={(e) => setEditForm({ ...editForm, monthlyGoal: parseInt(e.target.value, 10) || 0 })} className="w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-gray-700" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded bg-violet-600 text-white text-xs disabled:opacity-50">
                      {saving ? '…' : 'Salvar'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded border border-gray-300 text-gray-600 text-xs">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Comissão Direta</span><span className="font-medium">{config.directCommissionPercent}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Override</span><span className="font-medium">{config.affiliateOverridePercent}%</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Créditos</span><span className="font-medium">{config.creditsLimit}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Saque Mínimo</span><span className="font-medium">R$ {(config.minPayoutCents / 100).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Meta Mensal</span><span className="font-medium">R$ {(config.monthlyGoal / 100).toFixed(2)}</span></div>
                  <button type="button" onClick={() => startEdit(config)} className="mt-3 px-3 py-1.5 rounded border border-gray-300 text-gray-600 text-xs hover:bg-gray-100">
                    Editar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
