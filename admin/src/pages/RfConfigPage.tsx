import { useEffect, useState } from 'react';
import { adminApi, type RfConfigPublic } from '@/lib/api';
import { Search } from 'lucide-react';

export function RfConfigPage() {
  const [config, setConfig] = useState<RfConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadConfig = () => {
    setLoading(true);
    setLoadError(null);
    adminApi.rfSearchConfig
      .get()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        setConfig(null);
        setLoadError(err instanceof Error ? err.message : 'Erro ao carregar configuração.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setSaving(true);
    setToast(null);
    try {
      const updated = await adminApi.rfSearchConfig.update({ enabled });
      setConfig(updated);
      setToast({ type: 'success', message: enabled ? 'Busca RF ativada.' : 'Busca RF desativada.' });
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
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Busca na Receita Federal</h1>
        <div className="h-24 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (loadError && !config) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Busca na Receita Federal</h1>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">{loadError}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Busca na Receita Federal</h1>
      {toast && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}
        >
          {toast.message}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <Search className="w-5 h-5 mt-0.5 text-violet-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Busca cruzada na RF</p>
              <p className="text-sm text-gray-500 mt-1">
                Quando ativado, resultados de pesquisa de empresas no Brasil são enriquecidos com dados da Receita Federal (CNPJ, situação, CNAE, endereço fiscal).
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config?.enabled ?? true}
            disabled={saving}
            onClick={() => handleToggle(!(config?.enabled ?? true))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 ${config?.enabled ? 'bg-violet-600' : 'bg-gray-300'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${config?.enabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        {config?.updatedAt && (
          <p className="text-xs text-gray-400">Última alteração: {new Date(config.updatedAt).toLocaleString('pt-BR')}</p>
        )}
      </div>
    </div>
  );
}
