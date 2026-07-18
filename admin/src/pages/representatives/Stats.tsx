import { useCallback, useEffect, useState } from 'react';
import { representativesApi, type RepStats } from '@/lib/api/representatives';
import { Users, DollarSign, TrendingUp, UserPlus, MousePointerClick } from 'lucide-react';

export function RepStatsPage() {
  const [stats, setStats] = useState<RepStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    representativesApi.getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return (
      <div>
        <div className="h-8 w-48 rounded bg-gray-200 animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />)}
        </div>
        <div className="h-48 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
        {error}
      </div>
    );
  }

  const s = stats!;

  // Commissions are paid in each representative's own market currency (BR -> BRL, US -> USD),
  // so amounts are shown per currency rather than summed into one misleading total.
  type CurrencyStatKey = 'totalCommissionsPaidMonthCents' | 'totalCommissionsPaidYearCents' | 'totalRevenueGeneratedCents';
  const formatByCurrency = (key: CurrencyStatKey): string => {
    const brl = s.byCurrency?.BRL[key] ?? s[key];
    const usd = s.byCurrency?.USD[key] ?? 0;
    const parts: string[] = [];
    if (brl || !usd) parts.push(`R$ ${(brl / 100).toFixed(2)}`);
    if (usd) parts.push(`$ ${(usd / 100).toFixed(2)}`);
    return parts.join(' · ');
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Representantes</p>
              <p className="text-2xl font-bold text-gray-900">{s.totalRepresentatives}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="text-green-600">{s.activeRepresentatives} ativos</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-500">{s.inactiveRepresentatives} inativos</span>
            <span className="text-gray-400">·</span>
            <span className="text-red-600">{s.suspendedRepresentatives} suspensos</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Comissões Pagas (Mês)</p>
              <p className="text-2xl font-bold text-gray-900">{formatByCurrency('totalCommissionsPaidMonthCents')}</p>
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">Ano: {formatByCurrency('totalCommissionsPaidYearCents')}</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Clientes Gerados</p>
              <p className="text-2xl font-bold text-gray-900">{s.totalClientsGenerated}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="text-orange-600">{s.totalLeads} leads</span>
            <span className="text-gray-400">·</span>
            <span className="text-green-600">{s.totalActiveClients} ativos</span>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <MousePointerClick className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Cliques nos Links</p>
              <p className="text-2xl font-bold text-gray-900">{s.totalLinkClicks}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Faturamento Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatByCurrency('totalRevenueGeneratedCents')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Resumo Geral</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-gray-500">Total de Comissões Pagas (Mês)</p>
            <p className="text-lg font-semibold text-gray-900">{formatByCurrency('totalCommissionsPaidMonthCents')}</p>
          </div>
          <div>
            <p className="text-gray-500">Total de Comissões Pagas (Ano)</p>
            <p className="text-lg font-semibold text-gray-900">{formatByCurrency('totalCommissionsPaidYearCents')}</p>
          </div>
          <div>
            <p className="text-gray-500">Clientes Gerados por Representantes</p>
            <p className="text-lg font-semibold text-gray-900">{s.totalClientsGenerated}</p>
          </div>
          <div>
            <p className="text-gray-500">Representantes Ativos</p>
            <p className="text-lg font-semibold text-green-600">{s.activeRepresentatives}</p>
          </div>
          <div>
            <p className="text-gray-500">Representantes Inativos</p>
            <p className="text-lg font-semibold text-gray-500">{s.inactiveRepresentatives}</p>
          </div>
          <div>
            <p className="text-gray-500">Representantes Suspensos</p>
            <p className="text-lg font-semibold text-red-600">{s.suspendedRepresentatives}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
