import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, type AdminWorkspaceDetail, type WorkspaceUpdateBody } from '@/lib/api';

const PLAN_OPTIONS: Array<WorkspaceUpdateBody['plan']> = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];

const PLAN_DEFAULT_LEADS: Record<string, number> = {
  FREE: 5,
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

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    adminApi
      .workspace(id)
      .then(setWorkspace)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id]);

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

  if (!id) {
    return <div className="text-zinc-400">ID não informado.</div>;
  }

  if (loading && !workspace) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
          ← Workspaces
        </Link>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
          ← Workspaces
        </Link>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div>
      <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
        ← Workspaces
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white">
          {workspace.name ?? workspace.id}
        </h1>
        <button
          type="button"
          disabled={actionLoading}
          onClick={openPlanModal}
          className="px-4 py-2 rounded-lg bg-violet-600/80 text-white text-sm font-medium hover:bg-violet-600 disabled:opacity-50"
        >
          Alterar plano
        </button>
      </div>
      {toast && (
        <div className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 text-sm">
          {toast}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {actionError}
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Plano</p>
            <p className="text-white">{workspace.plan}</p>
          </div>
          <div>
            <p className="text-zinc-500">Leads usados / limite</p>
            <p className="text-white">{workspace.leadsUsed} / {workspace.leadsLimit}</p>
          </div>
          <div>
            <p className="text-zinc-500">Membros</p>
            <p className="text-white">{workspace._count.members}</p>
          </div>
          <div>
            <p className="text-zinc-500">Análises</p>
            <p className="text-white">{workspace._count.analyses}</p>
          </div>
          <div>
            <p className="text-zinc-500">Criado em</p>
            <p className="text-white">{new Date(workspace.createdAt).toLocaleString('pt-BR')}</p>
          </div>
        </div>
        {workspace.usage && (
          <div>
            <p className="text-zinc-500 text-sm mb-2">Uso</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <p className="text-zinc-500">Google (busca)</p>
                <p className="text-white">{workspace.usage.googlePlacesSearch.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500">Google (detalhes)</p>
                <p className="text-white">{workspace.usage.googlePlacesDetails.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500">Serper</p>
                <p className="text-white">{workspace.usage.serperRequests.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500">Tokens IA (entrada)</p>
                <p className="text-white">{workspace.usage.aiInputTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-zinc-500">Tokens IA (saída)</p>
                <p className="text-white">{workspace.usage.aiOutputTokens.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
        {workspace.members.length > 0 && (
          <div>
            <p className="text-zinc-500 text-sm mb-2">Membros</p>
            <ul className="space-y-1">
              {workspace.members.map((m) => (
                <li key={m.id} className="text-sm text-zinc-300">
                  {m.user.name ?? m.user.email ?? m.user.id}
                  {m.user.email && (
                    <span className="text-zinc-500 ml-2">({m.user.email})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Alterar plano</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Defina o plano e opcionalmente o limite de leads (deixe em branco para usar o padrão do plano).
            </p>
            <div className="mb-4">
              <label className="block text-zinc-500 text-sm mb-1">Plano</label>
              <select
                value={planModalPlan}
                onChange={(e) => {
                  const newPlan = e.target.value as WorkspaceUpdateBody['plan'];
                  setPlanModalPlan(newPlan);
                  const key = newPlan ?? 'FREE';
                  setPlanModalLeadsLimit(String(PLAN_DEFAULT_LEADS[key] ?? 10));
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-zinc-500 text-sm mb-1">Limite de leads (opcional)</label>
              <input
                type="number"
                min={0}
                value={planModalLeadsLimit}
                onChange={(e) => setPlanModalLeadsLimit(e.target.value)}
                placeholder="Padrão do plano"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-600"
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
