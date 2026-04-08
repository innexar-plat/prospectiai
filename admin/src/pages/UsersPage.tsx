import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { adminApi, supportApi, type AdminUserListItem, type SupportUserListItem, type AdminListParams, type SupportUsersParams } from '@/lib/api';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

const PAGE_SIZE = 20;

export function UsersPage() {
  const { role } = useOutletContext<AdminLayoutContext>();
  const isSupport = role === 'support';
  const [data, setData] = useState<{ items: AdminUserListItem[] | SupportUserListItem[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    if (isSupport) {
      const params: SupportUsersParams = { limit: PAGE_SIZE, offset };
      if (search.trim()) params.search = search.trim();
      supportApi
        .users(params)
        .then((res) => setData({ items: res.items, total: res.total }))
        .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
        .finally(() => setLoading(false));
    } else {
      const params: AdminListParams = { limit: PAGE_SIZE, offset };
      adminApi
        .users(params)
        .then((res) => setData({ items: res.items, total: res.total }))
        .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
        .finally(() => setLoading(false));
    }
  }, [offset, isSupport, search]);

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Usuários</h1>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Usuários</h1>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Usuários</h1>
        {isSupport && (
          <input
            type="search"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 w-full sm:w-64"
          />
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                {isSupport ? (
                  <th className="px-4 py-3 font-medium">Status</th>
                ) : (
                  <>
                    <th className="px-4 py-3 font-medium">Onboarding</th>
                    <th className="px-4 py-3 font-medium">Workspaces</th>
                  </>
                )}
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium w-20" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={isSupport ? 6 : 7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-200">
                    <td className="px-4 py-3 text-gray-900">{u.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{u.plan}</td>
                    {isSupport ? (
                      <td className="px-4 py-3 text-gray-500">
                        {u.disabledAt ? 'Desativado' : 'Ativo'}
                      </td>
                    ) : (
                      (() => {
                        if (!('_count' in u) || !('onboardingCompletedAt' in u)) return null;
                        return (
                          <>
                            <td className="px-4 py-3 text-gray-500">
                              {u.onboardingCompletedAt ? 'Sim' : 'Não'}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{(u as { _count: { workspaces: number } })._count.workspaces}</td>
                          </>
                        );
                      })()
                    )}
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/users/${u.id}`}
                        className="text-violet-600 hover:text-violet-700 text-xs font-medium"
                      >
                        Ver
                      </Link>
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
