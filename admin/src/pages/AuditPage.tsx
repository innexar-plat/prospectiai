import { useEffect, useState } from 'react';
import {
  adminApi,
  type AdminAuditLogItem,
  type AdminListParams,
} from '@/lib/api';

const PAGE_SIZE = 50;

export function AuditPage() {
  const [data, setData] = useState<{
    items: AdminAuditLogItem[];
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params: AdminListParams = { limit: PAGE_SIZE, offset };
    adminApi
      .auditLogs(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset]);

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Auditoria</h1>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Auditoria</h1>
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
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Log de auditoria</h1>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Admin</th>
                <th className="px-4 py-3 font-medium">Ação</th>
                <th className="px-4 py-3 font-medium">Recurso</th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum registro de auditoria.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-200">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.adminEmail ?? item.userId}</td>
                    <td className="px-4 py-3 text-gray-900">{item.action}</td>
                    <td className="px-4 py-3 text-gray-500">{item.resource ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {item.resourceId ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                      {item.details
                        ? JSON.stringify(item.details)
                        : '—'}
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
