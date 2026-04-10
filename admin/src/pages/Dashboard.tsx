import { useEffect, useState } from 'react';
import { adminApi, type AdminStats, type StatsHistoryResponse } from '@/lib/api';
import { Sparkline } from '@/components/ui/Sparkline';

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [history, setHistory] = useState<StatsHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.stats(), adminApi.statsHistory(7)])
      .then(([s, h]) => { setStats(s); setHistory(h); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-gray-200 animate-pulse"
            data-testid="dashboard-skeleton"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const mainCards = [
    { label: 'Usuários', value: stats.users, color: 'text-violet-600', sparkColor: '#8B5CF6', key: 'users' as const },
    { label: 'Workspaces', value: stats.workspaces, color: 'text-blue-600', sparkColor: '#2563EB', key: null },
    { label: 'Histórico de buscas', value: stats.searchHistory, color: 'text-emerald-600', sparkColor: '#059669', key: 'searches' as const },
    { label: 'Análises de leads', value: stats.leadAnalyses, color: 'text-amber-600', sparkColor: '#D97706', key: 'analyses' as const },
  ] as const;

  const usageCards = [
    { label: 'Google (busca)', value: stats.googlePlacesSearchTotal ?? 0, key: 'googleSearch' as const, color: '#6366F1' },
    { label: 'Google (detalhes)', value: stats.googlePlacesDetailsTotal ?? 0, key: 'googleDetails' as const, color: '#8B5CF6' },
    { label: 'Serper', value: stats.serperRequestsTotal ?? 0, key: 'serper' as const, color: '#059669' },
    { label: 'Tokens IA (entrada)', value: stats.aiInputTokensTotal ?? 0, key: null, color: '#D97706' },
    { label: 'Tokens IA (saída)', value: stats.aiOutputTokensTotal ?? 0, key: null, color: '#DC2626' },
  ] as const;

  const series = history?.series ?? [];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mainCards.map(({ label, value, color, sparkColor, key }) => {
          const sparkData = key ? series.map((d) => d[key]) : [];
          return (
            <div
              key={label}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <div className="flex items-end justify-between mt-1">
                <p className={`text-3xl font-bold ${color}`}>{value.toLocaleString()}</p>
                {sparkData.length > 1 && <Sparkline data={sparkData} color={sparkColor} />}
              </div>
              {sparkData.length > 1 && (
                <p className="text-[10px] text-gray-400 mt-1">Últimos 7 dias</p>
              )}
            </div>
          );
        })}
      </div>
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Uso (totais)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {usageCards.map(({ label, value, key, color: uColor }) => {
          const sparkData = key ? series.map((d) => d[key]) : [];
          return (
            <div
              key={label}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <div className="flex items-end justify-between mt-1">
                <p className="text-xl font-bold text-gray-900">{value.toLocaleString()}</p>
                {sparkData.length > 1 && <Sparkline data={sparkData} width={80} height={24} color={uColor} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
