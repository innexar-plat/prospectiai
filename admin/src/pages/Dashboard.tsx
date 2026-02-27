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
            className="h-24 rounded-xl bg-zinc-800/50 animate-pulse"
            data-testid="dashboard-skeleton"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const mainCards = [
    { label: 'Usuários', value: stats.users },
    { label: 'Workspaces', value: stats.workspaces },
    { label: 'Histórico de buscas', value: stats.searchHistory },
    { label: 'Análises de leads', value: stats.leadAnalyses },
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
      <h1 className="text-xl font-semibold text-white mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mainCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="text-2xl font-semibold text-white mt-1">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-medium text-zinc-300 mb-3">Uso (totais)</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {usageCards.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4"
          >
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="text-2xl font-semibold text-white mt-1">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
