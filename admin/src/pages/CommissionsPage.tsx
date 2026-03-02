import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminCommissionListItem } from '@/lib/api';

const PAGE_SIZE = 20;

export function CommissionsPage() {
  const [data, setData] = useState<{ items: AdminCommissionListItem[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchCommissions = useCallback(() => {
    setLoading(true);
    const params: { limit: number; offset: number; status?: string } = { limit: PAGE_SIZE, offset };
    if (statusFilter) params.status = statusFilter;
    adminApi.commissions(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset, statusFilter]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const handleMarkPaid = async (affiliateId: string, commissionId: string) => {
    if (payingId) return;
    setPayingId(commissionId);
    try {
      await adminApi.markCommissionPaid(affiliateId, commissionId);
      fetchCommissions();
    } finally {
      setPayingId(null);
    }
  };

  if (loading && !data) return <div><h1 className="text-xl font-semibold text-white mb-6">Comissões</h1><div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" /></div>;
  if (error && !data) return <div><h1 className="text-xl font-semibold text-white mb-6">Comissões</h1><div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">{error}</div></div>;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Comissões</h1>
      <div className="mb-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }} className="rounded border border-zinc-700 bg-zinc-800 text-zinc-200 px-3 py-2 text-sm">
          <option value="">Todos status</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="PAID">PAID</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-500">
              <th className="px-4 py-3 font-medium">Afiliado</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Disponível</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-zinc-800/50">
                <td className="px-4 py-3"><Link to={`/affiliates/${c.affiliateId}`} className="text-violet-400 font-mono">{c.affiliateCode}</Link></td>
                <td className="px-4 py-3">{c.currency === 'BRL' ? 'R$' : '$'} {(c.amountCents / 100).toFixed(2)}</td>
                <td className="px-4 py-3">{c.status}</td>
                <td className="px-4 py-3 text-zinc-400">{new Date(c.availableAt).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-zinc-400">{c.paidAt ? new Date(c.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  {c.status === 'APPROVED' ? (
                    <button
                      type="button"
                      onClick={() => handleMarkPaid(c.affiliateId, c.id)}
                      disabled={payingId !== null}
                      className="text-xs px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                    >
                      {payingId === c.id ? '…' : 'Marcar como pago'}
                    </button>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex gap-2 text-sm text-zinc-400">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} className="px-3 py-1 rounded border border-zinc-700 disabled:opacity-50">Anterior</button>
          <span>Página {currentPage} de {totalPages}</span>
          <button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((o) => o + PAGE_SIZE)} className="px-3 py-1 rounded border border-zinc-700 disabled:opacity-50">Próxima</button>
        </div>
      )}
    </div>
  );
}
