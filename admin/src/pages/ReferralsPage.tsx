import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminReferralListItem } from '@/lib/api';

const PAGE_SIZE = 20;

export function ReferralsPage() {
  const [data, setData] = useState<{ items: AdminReferralListItem[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [convertedFilter, setConvertedFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params: { limit: number; offset: number; converted?: string } = { limit: PAGE_SIZE, offset };
    if (convertedFilter) params.converted = convertedFilter;
    adminApi
      .referrals(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset, convertedFilter]);

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Referrals</h1>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-white mb-6">Referrals</h1>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">{error}</div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      <h1 className="text-xl font-semibold text-white mb-6">Funil de Referrals</h1>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-zinc-400 text-sm">Convertido</label>
        <select
          value={convertedFilter}
          onChange={(e) => { setConvertedFilter(e.target.value); setOffset(0); }}
          className="rounded border border-zinc-700 bg-zinc-800 text-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="px-4 py-3 font-medium">Afiliado</th>
                <th className="px-4 py-3 font-medium">Email (mascarado)</th>
                <th className="px-4 py-3 font-medium">Cadastro</th>
                <th className="px-4 py-3 font-medium">Convertido</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">
                    <Link to={`affiliates/${r.affiliateId}`} className="text-violet-400 hover:text-violet-300 font-mono">{r.affiliateCode}</Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{r.emailMasked ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-300">{new Date(r.signupAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">{r.convertedAt ? `Sim (${new Date(r.convertedAt).toLocaleDateString('pt-BR')})` : 'Não'}</td>
                  <td className="px-4 py-3 text-zinc-400">{r.planId ?? '—'}</td>
                  <td className="px-4 py-3">{r.valueCents != null ? `R$ ${(r.valueCents / 100).toFixed(2)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
          <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))} className="px-3 py-1 rounded border border-zinc-700 disabled:opacity-50">Anterior</button>
          <span>Página {currentPage} de {totalPages}</span>
          <button type="button" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset((o) => o + PAGE_SIZE)} className="px-3 py-1 rounded border border-zinc-700 disabled:opacity-50">Próxima</button>
        </div>
      )}
    </div>
  );
}
