import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';

interface EmailLogItem {
  id: string;
  type: string;
  email: string;
  subject: string;
  status: string;
  provider: string | null;
  error: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  SENT: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  BOUNCED: 'bg-orange-100 text-orange-700',
};

const TYPE_LABELS: Record<string, string> = {
  TRANSACTIONAL: 'Transacional',
  CAMPAIGN: 'Campanha',
  WEEKLY_REPORT: 'Relatório',
  SYSTEM: 'Sistema',
};

export function EmailLogsPage() {
  const [items, setItems] = useState<EmailLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.emailLogs({
        limit,
        offset: page * limit,
        type: filterType || undefined,
        status: filterStatus || undefined,
        email: filterEmail || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs de email.');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, filterStatus, filterEmail]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Logs de Email</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="TRANSACTIONAL">Transacional</option>
          <option value="CAMPAIGN">Campanha</option>
          <option value="WEEKLY_REPORT">Relatório Semanal</option>
          <option value="SYSTEM">Sistema</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="SENT">Enviado</option>
          <option value="FAILED">Falhou</option>
          <option value="PENDING">Pendente</option>
          <option value="BOUNCED">Bounce</option>
        </select>
        <input
          type="text"
          placeholder="Filtrar por email..."
          value={filterEmail}
          onChange={(e) => { setFilterEmail(e.target.value); setPage(0); }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-56"
        />
      </div>

      {/* Stats summary */}
      <p className="text-xs text-gray-500 mb-3">{total} registro{total !== 1 ? 's' : ''}</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-4 py-2 font-medium text-gray-600">Data</th>
              <th className="px-4 py-2 font-medium text-gray-600">Tipo</th>
              <th className="px-4 py-2 font-medium text-gray-600">Email</th>
              <th className="px-4 py-2 font-medium text-gray-600">Assunto</th>
              <th className="px-4 py-2 font-medium text-gray-600">Status</th>
              <th className="px-4 py-2 font-medium text-gray-600">Provedor</th>
              <th className="px-4 py-2 font-medium text-gray-600">Erro</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Carregando...</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum registro encontrado.</td></tr>
            )}
            {!loading && items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                  {new Date(item.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="text-xs font-medium text-gray-700">{TYPE_LABELS[item.type] ?? item.type}</span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-700 max-w-[180px] truncate" title={item.email}>
                  {item.email}
                </td>
                <td className="px-4 py-2 text-xs text-gray-700 max-w-[220px] truncate" title={item.subject}>
                  {item.subject}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{item.provider ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-red-600 max-w-[200px] truncate" title={item.error ?? ''}>
                  {item.error ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs text-gray-500">
            Página {page + 1} de {totalPages}
          </span>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
