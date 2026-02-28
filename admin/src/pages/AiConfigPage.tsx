import { useEffect, useState } from 'react';
import {
  adminApi,
  type AiConfigListItem,
  type AiConfigRole,
  type AiConfigProvider,
  type AiConfigCreateBody,
  type WebSearchConfigItem,
  type WebSearchProvider,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const ROLES: { value: AiConfigRole; label: string }[] = [
  { value: 'lead_analysis', label: 'Análise de lead' },
  { value: 'viability', label: 'Viabilidade' },
];

const PROVIDERS: { value: AiConfigProvider; label: string }[] = [
  { value: 'GEMINI', label: 'Gemini' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'CLOUDFLARE', label: 'Cloudflare' },
];

const WEB_SEARCH_PROVIDERS: { value: WebSearchProvider; label: string }[] = [
  { value: 'SERPER', label: 'Serper' },
  { value: 'TAVILY', label: 'Tavily' },
];

/** Cloudflare Workers AI — Text Generation (protocolo OpenAI). Só modelos de texto para chat/completion. */
const CLOUDFLARE_MODELS: { value: string; label: string }[] = [
  { value: '@cf/openai/gpt-oss-120b', label: 'OpenAI gpt-oss-120b (120B, produção)' },
  { value: '@cf/openai/gpt-oss-20b', label: 'OpenAI gpt-oss-20b (20B, baixa latência)' },
  { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Meta Llama 4 Scout 17B' },
  { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Meta Llama 3.3 70B (fp8 fast)' },
  { value: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Meta Llama 3.1 8B (fast)' },
  { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Meta Llama 3.1 8B' },
  { value: '@cf/meta/llama-3.1-70b-instruct', label: 'Meta Llama 3.1 70B' },
  { value: '@cf/meta/llama-3.2-3b-instruct', label: 'Meta Llama 3.2 3B' },
  { value: '@cf/meta/llama-3.2-1b-instruct', label: 'Meta Llama 3.2 1B' },
  { value: '@cf/ibm/granite-4.0-h-micro', label: 'IBM Granite 4.0 H Micro' },
  { value: '@cf/zai-org/glm-4.7-flash', label: 'GLM-4.7-Flash (zai-org)' },
  { value: '@cf/aisingapore/gemma-sea-lion-v4-27b-it', label: 'SEA-LION v4 27B (aisingapore)' },
  { value: '@cf/qwen/qwen3-30b-a3b-fp8', label: 'Qwen3 30B (fp8)' },
  { value: '@cf/qwen/qwq-32b', label: 'Qwen QwQ-32B (reasoning)' },
  { value: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1 24B' },
  { value: '@cf/mistralai/mistral-7b-instruct-v0.2', label: 'Mistral 7B Instruct v0.2' },
  { value: '@cf/deepseek/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill Qwen 32B' },
  { value: '@cf/google/gemma-3-12b-it', label: 'Google Gemma 3 12B' },
  { value: '@cf/google/gemma-7b-it', label: 'Google Gemma 7B' },
  { value: '@cf/microsoft/phi-2', label: 'Microsoft Phi-2' },
];

export function AiConfigPage() {
  const [items, setItems] = useState<AiConfigListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AiConfigListItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [webSearchForm, setWebSearchForm] = useState<Record<AiConfigRole, { provider: WebSearchProvider; apiKey: string; maxResults: number; enabled: boolean }>>({
    lead_analysis: { provider: 'SERPER', apiKey: '', maxResults: 5, enabled: false },
    viability: { provider: 'SERPER', apiKey: '', maxResults: 5, enabled: false },
  });
  const [webSearchSaving, setWebSearchSaving] = useState<AiConfigRole | null>(null);
  const [form, setForm] = useState<{
    role: AiConfigRole;
    provider: AiConfigProvider;
    model: string;
    apiKey: string;
    cloudflareAccountId: string;
    enabled: boolean;
  }>({
    role: 'lead_analysis',
    provider: 'GEMINI',
    model: 'gemini-flash-latest',
    apiKey: '',
    cloudflareAccountId: '',
    enabled: true,
  });

  const fetchList = () => {
    setLoading(true);
    Promise.all([adminApi.aiConfig.list(), adminApi.webSearchConfig.list()])
      .then(([aiRes, webRes]) => {
        setItems(aiRes.items);
        const byRole: Record<AiConfigRole, WebSearchConfigItem | undefined> = {
          lead_analysis: webRes.items.find((w) => w.role === 'lead_analysis'),
          viability: webRes.items.find((w) => w.role === 'viability'),
        };
        setWebSearchForm({
          lead_analysis: {
            provider: byRole.lead_analysis?.provider ?? 'SERPER',
            apiKey: '',
            maxResults: byRole.lead_analysis?.maxResults ?? 5,
            enabled: byRole.lead_analysis?.enabled ?? false,
          },
          viability: {
            provider: byRole.viability?.provider ?? 'SERPER',
            apiKey: '',
            maxResults: byRole.viability?.maxResults ?? 5,
            enabled: byRole.viability?.enabled ?? false,
          },
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchList();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      role: 'lead_analysis',
      provider: 'GEMINI',
      model: 'gemini-flash-latest',
      apiKey: '',
      cloudflareAccountId: '',
      enabled: true,
    });
    setModalOpen(true);
  };
  const setProvider = (provider: AiConfigProvider) => {
    setForm((f) => {
      const next = { ...f, provider };
      if (provider === 'CLOUDFLARE' && !CLOUDFLARE_MODELS.some((m) => m.value === f.model)) {
        next.model = '@cf/openai/gpt-oss-120b';
      }
      if (provider === 'GEMINI') next.model = 'gemini-flash-latest';
      if (provider === 'OPENAI') next.model = 'gpt-4o-mini';
      return next;
    });
  };

  const openEdit = (row: AiConfigListItem) => {
    setEditing(row);
    setForm({
      role: row.role,
      provider: row.provider,
      model: row.model,
      apiKey: '',
      cloudflareAccountId: row.cloudflareAccountId ?? '',
      enabled: row.enabled,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const body: { role: AiConfigRole; provider: AiConfigProvider; model: string; apiKey?: string; cloudflareAccountId?: string | null; enabled: boolean } = {
          role: form.role,
          provider: form.provider,
          model: form.model.trim(),
          cloudflareAccountId: form.cloudflareAccountId.trim() || null,
          enabled: form.enabled,
        };
        if (form.apiKey) body.apiKey = form.apiKey;
        await adminApi.aiConfig.update(editing.id, body);
        setToast({ type: 'success', message: 'Configuração atualizada.' });
      } else {
        const body: AiConfigCreateBody = {
          role: form.role,
          provider: form.provider,
          model: form.model.trim(),
          enabled: form.enabled,
          cloudflareAccountId: form.cloudflareAccountId.trim() || undefined,
        };
        if (form.apiKey) body.apiKey = form.apiKey;
        await adminApi.aiConfig.create(body);
        setToast({ type: 'success', message: 'Configuração criada.' });
      }
      setModalOpen(false);
      fetchList();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await adminApi.aiConfig.test(id);
      setToast({ type: 'success', message: 'Teste OK. Conexão funcionando.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Teste falhou';
      setToast({ type: 'error', message: msg });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta configuração?')) return;
    try {
      await adminApi.aiConfig.delete(id);
      setToast({ type: 'success', message: 'Configuração excluída.' });
      fetchList();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao excluir' });
    }
  };

  const handleSaveWebSearch = async (role: AiConfigRole) => {
    setWebSearchSaving(role);
    try {
      const f = webSearchForm[role];
      await adminApi.webSearchConfig.upsert({
        role,
        provider: f.provider,
        apiKey: f.apiKey || undefined,
        maxResults: f.maxResults,
        enabled: f.enabled,
      });
      setToast({ type: 'success', message: 'Busca na web atualizada.' });
      fetchList();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar' });
    } finally {
      setWebSearchSaving(null);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">IA / Provedores</h1>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white">IA / Provedores</h1>
        <Button onClick={openCreate} size="sm">
          Adicionar configuração
        </Button>
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && items.length === 0 && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Papel</th>
                <th className="px-4 py-3 font-medium">Provedor</th>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Chave</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-40">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Nenhuma configuração. Adicione uma para usar IA por papel (análise de lead, viabilidade).
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/80 hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-white">
                      {c.role === 'lead_analysis' ? 'Análise de lead' : 'Viabilidade'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{c.provider}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.model}</td>
                    <td className="px-4 py-3 text-zinc-500">{c.hasApiKey ? '••••••' : '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          c.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-600/30 text-zinc-500'
                        }`}
                      >
                        {c.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTest(c.id)}
                        disabled={!c.hasApiKey || testingId === c.id}
                        className="text-violet-400 hover:text-violet-300 text-xs font-medium disabled:opacity-50"
                      >
                        {testingId === c.id ? 'Testando...' : 'Testar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="text-violet-400 hover:text-violet-300 text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-red-400 hover:text-red-300 text-xs font-medium"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-3">Enriquecimento com busca na web</h2>
        <p className="text-sm text-zinc-500 mb-4">
          Opcional. Se ativo, análises (lead e viabilidade) recebem contexto real da web (ex.: Serper). Configure por papel.
        </p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="px-4 py-3 font-medium">Papel</th>
                  <th className="px-4 py-3 font-medium">Provedor</th>
                  <th className="px-4 py-3 font-medium">Chave API</th>
                  <th className="px-4 py-3 font-medium">Máx. resultados</th>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  <th className="px-4 py-3 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {(['lead_analysis', 'viability'] as const).map((role) => (
                  <tr key={role} className="border-b border-zinc-800/80">
                    <td className="px-4 py-3 text-white">
                      {role === 'lead_analysis' ? 'Análise de lead' : 'Viabilidade'}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={webSearchForm[role].provider}
                        onChange={(e) =>
                          setWebSearchForm((prev) => ({
                            ...prev,
                            [role]: { ...prev[role], provider: e.target.value as WebSearchProvider },
                          }))
                        }
                        className="border-zinc-700 bg-zinc-800 text-zinc-200 w-32"
                      >
                        {WEB_SEARCH_PROVIDERS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="password"
                        value={webSearchForm[role].apiKey}
                        onChange={(e) =>
                          setWebSearchForm((prev) => ({
                            ...prev,
                            [role]: { ...prev[role], apiKey: e.target.value },
                          }))
                        }
                        placeholder="Deixe vazio para manter"
                        className="border-zinc-700 bg-zinc-800 text-zinc-200 max-w-xs"
                        autoComplete="off"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={webSearchForm[role].maxResults}
                        onChange={(e) =>
                          setWebSearchForm((prev) => ({
                            ...prev,
                            [role]: { ...prev[role], maxResults: parseInt(e.target.value, 10) || 5 },
                          }))
                        }
                        className="border-zinc-700 bg-zinc-800 text-zinc-200 w-20"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={webSearchForm[role].enabled}
                        onChange={(e) =>
                          setWebSearchForm((prev) => ({
                            ...prev,
                            [role]: { ...prev[role], enabled: e.target.checked },
                          }))
                        }
                        className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSaveWebSearch(role)}
                        isLoading={webSearchSaving === role}
                      >
                        Salvar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setModalOpen(false)}>
          <div
            className="rounded-xl border border-zinc-700 bg-zinc-900 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar configuração' : 'Nova configuração'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Papel</label>
                <Select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AiConfigRole }))}
                  className="w-full border-zinc-700 bg-zinc-800 text-zinc-200"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Provedor</label>
                <Select
                  value={form.provider}
                  onChange={(e) => setProvider(e.target.value as AiConfigProvider)}
                  className="w-full border-zinc-700 bg-zinc-800 text-zinc-200"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Modelo</label>
                {form.provider === 'CLOUDFLARE' ? (
                  <>
                    <p className="text-xs text-zinc-500 mb-1">Cloudflare usa protocolo OpenAI (chat completions).</p>
                    <Select
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      className="w-full border-zinc-700 bg-zinc-800 text-zinc-200 mb-2"
                    >
                      {CLOUDFLARE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      placeholder="ou digite outro ID (@cf/...)"
                      className="border-zinc-700 bg-zinc-800 text-zinc-200 text-sm"
                      required
                    />
                  </>
                ) : (
                  <Input
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    placeholder={form.provider === 'OPENAI' ? 'ex: gpt-4o-mini, gpt-4o' : 'ex: gemini-2.0-flash'}
                    className="border-zinc-700 bg-zinc-800 text-zinc-200"
                    required
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Chave API {editing && '(deixe vazio para manter a atual)'}
                </label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder="••••••••"
                  className="border-zinc-700 bg-zinc-800 text-zinc-200"
                  autoComplete="off"
                />
              </div>
              {form.provider === 'CLOUDFLARE' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Cloudflare Account ID</label>
                  <Input
                    value={form.cloudflareAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, cloudflareAccountId: e.target.value }))}
                    placeholder="Account ID"
                    className="border-zinc-700 bg-zinc-800 text-zinc-200"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800 text-violet-500"
                />
                <label htmlFor="enabled" className="text-sm text-zinc-400">
                  Ativo
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={submitting}>
                  {editing ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
