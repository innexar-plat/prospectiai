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
        <h1 className="text-xl font-semibold text-white mb-6">Usuários</h1>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Usuários</h1>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white">Usuários</h1>
        {isSupport && (
          <input
            type="search"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 w-full sm:w-64"
          />
        )}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
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
                  <td colSpan={isSupport ? 6 : 7} className="px-4 py-8 text-center text-zinc-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                items.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-800/80 hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-white">{u.name ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{u.email ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{u.plan}</td>
                    {isSupport ? (
                      <td className="px-4 py-3 text-zinc-400">
                        {u.disabledAt ? 'Desativado' : 'Ativo'}
                      </td>
                    ) : (
                      (() => {
                        if (!('_count' in u) || !('onboardingCompletedAt' in u)) return null;
                        return (
                          <>
                            <td className="px-4 py-3 text-zinc-400">
                              {u.onboardingCompletedAt ? 'Sim' : 'Não'}
                            </td>
                            <td className="px-4 py-3 text-zinc-400">{(u as { _count: { workspaces: number } })._count.workspaces}</td>
                          </>
                        );
                      })()
                    )}
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/users/${u.id}`}
                        className="text-violet-400 hover:text-violet-300 text-xs font-medium"
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
