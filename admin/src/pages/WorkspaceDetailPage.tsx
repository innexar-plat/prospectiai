import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, type AdminWorkspaceDetail, type WorkspaceUpdateBody } from '@/lib/api';
import { useConfirm } from '@/lib/useConfirm';

const PLAN_OPTIONS: Array<WorkspaceUpdateBody['plan']> = ['FREE', 'TRIAL', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

const PLAN_DEFAULT_LEADS: Record<string, number> = {
  FREE: 10,
  TRIAL: 50,
  BASIC: 100,
  PRO: 400,
  BUSINESS: 1200,
  SCALE: 5000,
};

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<AdminWorkspaceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planModalPlan, setPlanModalPlan] = useState<WorkspaceUpdateBody['plan']>('FREE');
  const [planModalLeadsLimit, setPlanModalLeadsLimit] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi
      .workspace(id)
      .then(setWorkspace)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id]);

  const [autoProspLoading, setAutoProspLoading] = useState(false);

  const handleToggleAutoProspeccao = async () => {
    if (!id || !workspace) return;
    const enabling = !workspace.autoProspeccaoEnabled;
    const ok = await confirm({
      title: enabling ? 'Ativar Auto-Prospecção' : 'Desativar Auto-Prospecção',
      message: enabling
        ? 'Ativar o módulo de Auto-Prospecção para este workspace?'
        : 'Desativar o módulo de Auto-Prospecção para este workspace?',
      confirmLabel: enabling ? 'Ativar' : 'Desativar',
      variant: enabling ? 'primary' : 'danger',
    });
    if (!ok) return;
    setAutoProspLoading(true);
    setActionError(null);
    adminApi
      .toggleAutoProspeccao(id)
      .then((res) => {
        setWorkspace((prev) =>
          prev ? { ...prev, autoProspeccaoEnabled: res.data.autoProspeccaoEnabled } : prev,
        );
        setToast(
          res.data.autoProspeccaoEnabled
            ? 'Auto-Prospecção ativada para este workspace.'
            : 'Auto-Prospecção desativada para este workspace.',
        );
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao alterar módulo'))
      .finally(() => setAutoProspLoading(false));
  };

  const openPlanModal = () => {
    if (workspace) {
      setPlanModalPlan(workspace.plan as WorkspaceUpdateBody['plan']);
      setPlanModalLeadsLimit(String(workspace.leadsLimit));
    }
    setShowPlanModal(true);
    setActionError(null);
  };

  const handleUpdatePlan = () => {
    if (!id) return;
    const body: WorkspaceUpdateBody = {
      plan: planModalPlan,
      leadsLimit: planModalLeadsLimit.trim() ? parseInt(planModalLeadsLimit, 10) : undefined,
    };
    if (Number.isNaN(body.leadsLimit)) body.leadsLimit = undefined;
    setActionLoading(true);
    setActionError(null);
    adminApi
      .updateWorkspace(id, body)
      .then((updated) => {
        setWorkspace(updated);
        setShowPlanModal(false);
        setToast('Plano e limite atualizados.');
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao atualizar'))
      .finally(() => setActionLoading(false));
  };

  const handleMarketChange = (newMarket: string) => {
    if (!id || !workspace) return;
    setActionLoading(true);
    setActionError(null);
    adminApi
      .updateWorkspace(id, { market: newMarket })
      .then((updated) => {
        setWorkspace(updated);
        setToast('Região atualizada com sucesso.');
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao atualizar região'))
      .finally(() => setActionLoading(false));
  };

  if (!id) {
    return <div className="text-gray-500">ID não informado.</div>;
  }

  if (loading && !workspace) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
          ← Workspaces
        </Link>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
          ← Workspaces
        </Link>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div>
      {ConfirmDialog}
      <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
        ← Workspaces
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {workspace.name ?? workspace.id}
        </h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            disabled={autoProspLoading}
            onClick={handleToggleAutoProspeccao}
            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
              workspace.autoProspeccaoEnabled
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
            }`}
          >
            {autoProspLoading
              ? 'Aguarde...'
              : workspace.autoProspeccaoEnabled
              ? '🤖 Auto-Prospecção: ON'
              : '🤖 Auto-Prospecção: OFF'}
          </button>
          <button
            type="button"
            disabled={actionLoading}
            onClick={openPlanModal}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
          >
            Alterar plano
          </button>
        </div>
      </div>
      {toast && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-600 px-4 py-3 text-sm">
          {toast}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3 text-sm">
          {actionError}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Plano</p>
            <p className="text-gray-900">{workspace.plan}</p>
          </div>
          <div>
            <p className="text-gray-500">Leads usados / limite</p>
            <p className="text-gray-900">{workspace.leadsUsed} / {workspace.leadsLimit}</p>
          </div>
          <div>
            <p className="text-gray-500">Região (Market)</p>
            <select
              value={workspace.market ?? 'BR'}
              onChange={(e) => handleMarketChange(e.target.value)}
              disabled={actionLoading}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-violet-500 focus:ring-violet-500 sm:text-sm bg-gray-50 text-gray-900 p-1 border"
            >
              <option value="BR">Brasil (BR)</option>
              <option value="US">Estados Unidos (US)</option>
            </select>
          </div>
          <div>
            <p className="text-gray-500">Membros</p>
            <p className="text-gray-900">{workspace._count.members}</p>
          </div>
          <div>
            <p className="text-gray-500">Análises</p>
            <p className="text-gray-900">{workspace._count.analyses}</p>
          </div>
          <div>
            <p className="text-gray-500">Criado em</p>
            <p className="text-gray-900">{new Date(workspace.createdAt).toLocaleString('pt-BR')}</p>
          </div>
          <div>
            <p className="text-gray-500">Auto-Prospecção</p>
            <p className={workspace.autoProspeccaoEnabled ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
              {workspace.autoProspeccaoEnabled ? 'Habilitada ✓' : 'Desabilitada'}
            </p>
          </div>
        </div>
        {workspace.usage && (
          <div>
            <p className="text-gray-500 text-sm mb-2">Uso</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Google (busca)</p>
                <p className="text-gray-900">{workspace.usage.googlePlacesSearch.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Google (detalhes)</p>
                <p className="text-gray-900">{workspace.usage.googlePlacesDetails.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Serper</p>
                <p className="text-gray-900">{workspace.usage.serperRequests.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Tokens IA (entrada)</p>
                <p className="text-gray-900">{workspace.usage.aiInputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Tokens IA (saída)</p>
                <p className="text-gray-900">{workspace.usage.aiOutputTokens.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
        {workspace.members.length > 0 && (
          <div>
            <p className="text-gray-500 text-sm mb-2">Membros</p>
            <ul className="space-y-1">
              {workspace.members.map((m) => (
                <li key={m.id} className="text-sm text-gray-600">
                  {m.user.name ?? m.user.email ?? m.user.id}
                  {m.user.email && (
                    <span className="text-gray-500 ml-2">({m.user.email})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xl max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Alterar plano</h2>
            <p className="text-gray-500 text-sm mb-4">
              Defina o plano e opcionalmente o limite de leads (deixe em branco para usar o padrão do plano).
            </p>
            <div className="mb-4">
              <label className="block text-gray-500 text-sm mb-1">Plano</label>
              <select
                value={planModalPlan}
                onChange={(e) => {
                  const newPlan = e.target.value as WorkspaceUpdateBody['plan'];
                  setPlanModalPlan(newPlan);
                  const key = newPlan ?? 'FREE';
                  setPlanModalLeadsLimit(String(PLAN_DEFAULT_LEADS[key] ?? 10));
                }}
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-gray-500 text-sm mb-1">Limite de leads (opcional)</label>
              <input
                type="number"
                min={0}
                value={planModalLeadsLimit}
                onChange={(e) => setPlanModalLeadsLimit(e.target.value)}
                placeholder="Padrão do plano"
                className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 placeholder-gray-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
