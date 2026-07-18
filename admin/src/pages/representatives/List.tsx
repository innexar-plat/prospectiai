import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { representativesApi, type RepresentativeListItem } from '@/lib/api/representatives';

const PAGE_SIZE = 20;

const levelBadge: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700',
  SILVER: 'bg-gray-200 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-700',
  PLATINUM: 'bg-purple-100 text-purple-700',
};

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-200 text-gray-500',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export function RepresentativesList() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ items: RepresentativeListItem[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: { limit: number; offset: number; search?: string; status?: string; level?: string } = {
      limit: PAGE_SIZE,
      offset,
    };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (levelFilter) params.level = levelFilter;
    representativesApi
      .list(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset, search, statusFilter, levelFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (id: string) => {
    if (deactivating) return;
    setDeactivating(id);
    try {
      await representativesApi.deactivate(id);
      setToast({ type: 'success', message: 'Representante desativado.' });
      setTimeout(() => setToast(null), 5000);
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao desativar.' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setDeactivating(null);
    }
  };

  if (loading && !data) {
    return (
      <div>
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse mb-6" />
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
        {error}
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            className="rounded border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm w-64"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="rounded border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm"
          >
            <option value="">Todos status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setOffset(0); }}
            className="rounded border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm"
          >
            <option value="">Todos níveis</option>
            <option value="BRONZE">BRONZE</option>
            <option value="SILVER">SILVER</option>
            <option value="GOLD">GOLD</option>
            <option value="PLATINUM">PLATINUM</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => navigate('novo')}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 w-full sm:w-auto text-center"
        >
          Novo Representante
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Nível</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Créditos</th>
                <th className="px-4 py-3 font-medium">Última Atividade</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum representante encontrado.
                  </td>
                </tr>
              ) : items.map((r) => (
                <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${levelBadge[r.level] ?? ''}`}>
                      {r.level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className={r.creditsUsed > r.creditsLimit ? 'text-red-600 font-medium' : ''}>
                      {r.creditsUsed}
                    </span>
                    /{r.creditsLimit}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={r.id} className="text-violet-600 hover:text-violet-700 text-sm">
                        Ver detalhes
                      </Link>
                      {r.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(r.id)}
                          disabled={deactivating === r.id}
                          className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deactivating === r.id ? '…' : 'Desativar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
