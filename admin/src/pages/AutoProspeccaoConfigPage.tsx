import { useEffect, useState } from 'react';
import { autoProspeccaoAdminApi, adminApi, type AutoProspConfig, type AdminWorkspaceListItem } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Settings, Search, Save, RefreshCw } from 'lucide-react';

const CRM_PROVIDERS = ['rdstation', 'hubspot', 'agendor', 'all'];

export function AutoProspeccaoConfigPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceListItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [config, setConfig] = useState<AutoProspConfig | null>(null);
  const [form, setForm] = useState<Partial<AutoProspConfig>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    adminApi
      .workspaces({ limit: 100 })
      .then((res) => setWorkspaces(res.items))
      .catch(() => showToast('error', 'Erro ao carregar workspaces.'));
  }, []);

  const loadConfig = (wsId: string) => {
    if (!wsId) return;
    setLoading(true);
    setConfig(null);
    autoProspeccaoAdminApi.config
      .get(wsId)
      .then((res) => {
        setConfig(res.data);
        setForm({ ...res.data });
      })
      .catch((err) =>
        showToast('error', err instanceof Error ? err.message : 'Erro ao carregar configuração.'),
      )
      .finally(() => setLoading(false));
  };

  const handleWorkspaceChange = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    loadConfig(wsId);
  };

  const handleSave = async () => {
    if (!selectedWorkspaceId || !form) return;
    setSaving(true);
    try {
      const res = await autoProspeccaoAdminApi.config.update(selectedWorkspaceId, form);
      setConfig(res.data);
      setForm({ ...res.data });
      showToast('success', 'Configuração salva com sucesso.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof AutoProspConfig>(key: K, value: AutoProspConfig[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuração do Módulo</h1>
          <p className="text-sm text-gray-500">Ajuste parâmetros de email, scoring e CRM por workspace.</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Workspace Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select
          className="flex-1 border-0 outline-none text-sm text-gray-800 bg-transparent"
          value={selectedWorkspaceId}
          onChange={(e) => handleWorkspaceChange(e.target.value)}
        >
          <option value="">Selecione um workspace...</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name ?? ws.id} {ws.autoProspeccaoEnabled ? '✓' : ''}
            </option>
          ))}
        </select>
        {selectedWorkspaceId && (
          <button
            onClick={() => loadConfig(selectedWorkspaceId)}
            className="text-gray-400 hover:text-gray-600"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center text-gray-400 text-sm py-8">Carregando configuração...</div>
      )}

      {/* Config Form */}
      {config && !loading && (
        <div className="space-y-6">
          {/* Status */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Status</h2>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive ?? false}
                onChange={(e) => set('isActive', e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-gray-700">Módulo ativo (executa cron automaticamente)</span>
            </label>
          </section>

          {/* Scoring */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Scoring</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Score mínimo HOT</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.hotScoreMin ?? 70}
                  onChange={(e) => set('hotScoreMin', parseInt(e.target.value, 10))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Score mínimo WARM</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.warmScoreMin ?? 40}
                  onChange={(e) => set('warmScoreMin', parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          </section>

          {/* Email */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Email</h2>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={form.emailAutoSend ?? true}
                onChange={(e) => set('emailAutoSend', e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-gray-700">Envio automático de email habilitado</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Intervalo entre steps (horas)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.emailStepIntervalHours ?? 48}
                  onChange={(e) => set('emailStepIntervalHours', parseInt(e.target.value, 10))}
                />
                <p className="text-xs text-gray-400 mt-1">Quantas horas esperar entre step 1→2→3</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Máx. emails por dia</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.maxEmailsPerDay ?? 200}
                  onChange={(e) => set('maxEmailsPerDay', parseInt(e.target.value, 10))}
                />
              </div>
            </div>
          </section>

          {/* CRM */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">CRM</h2>
            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={form.crmAutoSend ?? false}
                onChange={(e) => set('crmAutoSend', e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-gray-700">Envio automático ao CRM habilitado</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Provider CRM</label>
                <select
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.crmProvider ?? ''}
                  onChange={(e) => set('crmProvider', e.target.value || null)}
                >
                  <option value="">Nenhum</option>
                  {CRM_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Máx. push por dia</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.maxCrmPushPerDay ?? 100}
                  onChange={(e) => set('maxCrmPushPerDay', parseInt(e.target.value, 10))}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">User ID do dono (crmOwnerUserId)</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono"
                  value={form.crmOwnerUserId ?? ''}
                  onChange={(e) => set('crmOwnerUserId', e.target.value || null)}
                  placeholder="ID do usuário com token de integração CRM"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Usuário cujo token será usado nas chamadas ao CRM. Atual: <strong>{config.crmOwnerUserId ?? 'não definido'}</strong>
                </p>
              </div>
            </div>
          </section>

          {/* Limites */}
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Limites Operacionais</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Máx. leads por execução</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.maxLeadsPerRun ?? 50}
                  onChange={(e) => set('maxLeadsPerRun', parseInt(e.target.value, 10))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Intervalo de busca (horas)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.searchIntervalHours ?? 24}
                  onChange={(e) => set('searchIntervalHours', parseInt(e.target.value, 10))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Horário início</label>
                <input
                  type="time"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.scheduleTimeStart ?? '08:00'}
                  onChange={(e) => set('scheduleTimeStart', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Horário fim</label>
                <input
                  type="time"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={form.scheduleTimeEnd ?? '20:00'}
                  onChange={(e) => set('scheduleTimeEnd', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !config && !selectedWorkspaceId && (
        <div className="text-center py-16 text-gray-400">
          <Settings className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione um workspace para ver e editar a configuração do módulo.</p>
        </div>
      )}
    </div>
  );
}
