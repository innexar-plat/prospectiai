import { useEffect, useState } from 'react';
import { adminApi, type AdminStats } from '@/lib/api';

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
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
    { label: 'Usuários', value: stats.users, color: 'text-violet-600' },
    { label: 'Workspaces', value: stats.workspaces, color: 'text-blue-600' },
    { label: 'Histórico de buscas', value: stats.searchHistory, color: 'text-emerald-600' },
    { label: 'Análises de leads', value: stats.leadAnalyses, color: 'text-amber-600' },
  ] as const;

  const usageCards = [
    { label: 'Google (busca)', value: stats.googlePlacesSearchTotal ?? 0 },
    { label: 'Google (detalhes)', value: stats.googlePlacesDetailsTotal ?? 0 },
    { label: 'Serper', value: stats.serperRequestsTotal ?? 0 },
    { label: 'Tokens IA (entrada)', value: stats.aiInputTokensTotal ?? 0 },
    { label: 'Tokens IA (saída)', value: stats.aiOutputTokensTotal ?? 0 },
  ] as const;

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mainCards.map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold text-gray-700 mb-3">Uso (totais)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {usageCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
