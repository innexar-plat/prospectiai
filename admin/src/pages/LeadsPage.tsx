import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminLeadListItem,
  type AdminListParams,
} from '@/lib/api';

const PAGE_SIZE = 20;

export function LeadsPage() {
  const [data, setData] = useState<{
    items: AdminLeadListItem[];
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
      .leads(params)
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
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Leads</h1>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Leads</h1>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
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
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Leads</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Workspace ID (opcional)"
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 text-sm w-56 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button
          type="button"
          onClick={applyWorkspaceFilter}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200"
        >
          Filtrar
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-200">
                    <td className="px-4 py-3">
                      <span className="text-gray-900">{item.lead.name}</span>
                      {item.lead.phone && (
                        <span className="text-gray-500 text-xs block">{item.lead.phone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.user.name ?? item.user.email ?? item.user.id}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.workspace?.name ?? item.workspace?.id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {total} resultado(s) · página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200"
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
