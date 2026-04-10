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
import { useConfirm } from '@/lib/useConfirm';

const ROLES: { value: AiConfigRole; label: string }[] = [
  { value: 'lead_analysis', label: 'Análise de lead' },
  { value: 'viability', label: 'Viabilidade' },
];

const PROVIDERS: { value: AiConfigProvider; label: string }[] = [
  { value: 'GEMINI', label: 'Gemini' },
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'CLOUDFLARE', label: 'Cloudflare' },
  { value: 'GROQ', label: 'Groq' },
  { value: 'DEEPSEEK', label: 'DeepSeek' },
  { value: 'ANTHROPIC', label: 'Anthropic' },
];

const WEB_SEARCH_PROVIDERS: { value: WebSearchProvider; label: string }[] = [
  { value: 'SERPER', label: 'Serper' },
  { value: 'TAVILY', label: 'Tavily' },
];

/** Modelos sugeridos por provedor */
const PROVIDER_MODELS: Record<AiConfigProvider, { value: string; label: string }[]> = {
  GEMINI: [
    { value: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash Preview' },
    { value: 'gemini-2.5-pro-preview-05-06', label: 'Gemini 2.5 Pro Preview' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  OPENAI: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3-mini (reasoning)' },
  ],
  CLOUDFLARE: [
    { value: '@cf/openai/gpt-oss-120b', label: 'OpenAI gpt-oss-120b (120B, produção)' },
    { value: '@cf/openai/gpt-oss-20b', label: 'OpenAI gpt-oss-20b (20B, baixa latência)' },
    { value: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Meta Llama 4 Scout 17B' },
    { value: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Meta Llama 3.3 70B (fp8 fast)' },
    { value: '@cf/meta/llama-3.1-8b-instruct-fast', label: 'Meta Llama 3.1 8B (fast)' },
    { value: '@cf/meta/llama-3.1-8b-instruct', label: 'Meta Llama 3.1 8B' },
    { value: '@cf/meta/llama-3.1-70b-instruct', label: 'Meta Llama 3.1 70B' },
    { value: '@cf/meta/llama-3.2-3b-instruct', label: 'Meta Llama 3.2 3B' },
    { value: '@cf/meta/llama-3.2-1b-instruct', label: 'Meta Llama 3.2 1B' },
    { value: '@cf/qwen/qwen3-30b-a3b-fp8', label: 'Qwen3 30B (fp8)' },
    { value: '@cf/qwen/qwq-32b', label: 'Qwen QwQ-32B (reasoning)' },
    { value: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1 24B' },
    { value: '@cf/deepseek/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill Qwen 32B' },
    { value: '@cf/google/gemma-3-12b-it', label: 'Google Gemma 3 12B' },
  ],
  GROQ: [
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B' },
  ],
  DEEPSEEK: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
  ],
  ANTHROPIC: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
};

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
  const { confirm, ConfirmDialog } = useConfirm();
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
      const models = PROVIDER_MODELS[provider];
      const next = { ...f, provider };
      if (!models.some((m) => m.value === f.model)) {
        next.model = models[0]?.value ?? '';
      }
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

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
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
    if (!(await confirm({ title: 'Excluir configuração', message: 'Tem certeza que deseja excluir esta configuração de IA?', confirmLabel: 'Excluir' }))) return;
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
        <h1 className="text-xl font-semibold text-gray-900 mb-6">IA / Provedores</h1>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">IA / Provedores</h1>
        <Button onClick={openCreate} size="sm">
          Adicionar configuração
        </Button>
      </div>

      {toast && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-600'
              : 'bg-red-50 border border-red-300 text-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}

      {error && items.length === 0 && (
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhuma configuração. Adicione uma para usar IA por papel (análise de lead, viabilidade).
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-200">
                    <td className="px-4 py-3 text-gray-900">
                      {c.role === 'lead_analysis' ? 'Análise de lead' : 'Viabilidade'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.provider}</td>
                    <td className="px-4 py-3 text-gray-500">{c.model}</td>
                    <td className="px-4 py-3 text-gray-500">{c.hasApiKey ? '••••••' : '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          c.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'
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
                        className="text-violet-600 hover:text-violet-700 text-xs font-medium disabled:opacity-50"
                      >
                        {testingId === c.id ? 'Testando...' : 'Testar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="text-violet-600 hover:text-violet-700 text-xs font-medium"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-red-600 hover:text-red-600 text-xs font-medium"
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
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Enriquecimento com busca na web</h2>
        <p className="text-sm text-gray-500 mb-4">
          Opcional. Se ativo, análises (lead e viabilidade) recebem contexto real da web (ex.: Serper). Configure por papel.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
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
                  <tr key={role} className="border-b border-gray-200">
                    <td className="px-4 py-3 text-gray-900">
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
                        className="border-gray-300 bg-gray-100 text-gray-700 w-32"
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
                        className="border-gray-300 bg-gray-100 text-gray-700 max-w-xs"
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
                        className="border-gray-300 bg-gray-100 text-gray-700 w-20"
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
                        className="rounded border-gray-300 bg-gray-100 text-violet-500"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setModalOpen(false)}>
          <div
            className="rounded-xl border border-gray-200 bg-white w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar configuração' : 'Nova configuração'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Papel</label>
                <Select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AiConfigRole }))}
                  className="w-full border-gray-300 bg-gray-100 text-gray-700"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Provedor</label>
                <Select
                  value={form.provider}
                  onChange={(e) => setProvider(e.target.value as AiConfigProvider)}
                  className="w-full border-gray-300 bg-gray-100 text-gray-700"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Modelo</label>
                {form.provider === 'CLOUDFLARE' && (
                  <p className="text-xs text-gray-500 mb-1">Cloudflare usa protocolo OpenAI (chat completions).</p>
                )}
                <Select
                  value={PROVIDER_MODELS[form.provider].some((m) => m.value === form.model) ? form.model : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value !== '__custom__') setForm((f) => ({ ...f, model: e.target.value }));
                  }}
                  className="w-full border-gray-300 bg-gray-100 text-gray-700 mb-2"
                >
                  {PROVIDER_MODELS[form.provider].map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  <option value="__custom__">Outro (digitar manualmente)</option>
                </Select>
                <Input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="ID do modelo (ex: gemini-2.0-flash)"
                  className="border-gray-300 bg-gray-100 text-gray-700 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Chave API {editing && '(deixe vazio para manter a atual)'}
                </label>
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder="••••••••"
                  className="border-gray-300 bg-gray-100 text-gray-700"
                  autoComplete="off"
                />
              </div>
              {form.provider === 'CLOUDFLARE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Cloudflare Account ID</label>
                  <Input
                    value={form.cloudflareAccountId}
                    onChange={(e) => setForm((f) => ({ ...f, cloudflareAccountId: e.target.value }))}
                    placeholder="Account ID"
                    className="border-gray-300 bg-gray-100 text-gray-700"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="rounded border-gray-300 bg-gray-100 text-violet-500"
                />
                <label htmlFor="enabled" className="text-sm text-gray-500">
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
      {ConfirmDialog}
    </div>
  );
}
