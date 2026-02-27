import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminSearchHistoryListItem,
  type AdminListParams,
} from '@/lib/api';

const PAGE_SIZE = 20;

export function SearchHistoryPage() {
  const [data, setData] = useState<{
    items: AdminSearchHistoryListItem[];
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [appliedWorkspaceId, setAppliedWorkspaceId] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    const params: AdminListParams = {
      limit: PAGE_SIZE,
      offset,
      ...(appliedWorkspaceId ? { workspaceId: appliedWorkspaceId } : {}),
    };
    adminApi
      .searchHistory(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset, appliedWorkspaceId]);

  const applyWorkspaceFilter = () => {
    setAppliedWorkspaceId(workspaceId.trim());
    setOffset(0);
  };

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Histórico de buscas</h1>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Histórico de buscas</h1>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Histórico de buscas</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Workspace ID (opcional)"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm w-56 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        <button
          type="button"
          onClick={applyWorkspaceFilter}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700"
        >
          Filtrar
        </button>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Query</th>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Resultados</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-800/80 hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-white max-w-xs truncate" title={item.textQuery}>
                      {item.textQuery}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.user.name ?? item.user.email ?? item.user.id}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {item.workspace.name ?? item.workspace.id}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{item.resultsCount ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <p className="text-sm text-zinc-500">
              {total} resultado(s) · página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
