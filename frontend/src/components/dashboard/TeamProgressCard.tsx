import { useState, useEffect } from 'react';
import { Target, Loader2, Trophy, Flame } from 'lucide-react';
import type { SessionUser } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ProgressResponse {
  goals: {
    dailyLeadsGoal: number | null;
    dailyAnalysesGoal: number | null;
    monthlyConversionsGoal: number | null;
  };
  today: { searches: number; analyses: number };
  month: { searches: number; analyses: number; actions: number };
  streak: number;
  ranking: {
    position: number;
    total: number;
    top5: Array<{ userId: string; name: string; monthlySearches: number }>;
  };
}

async function fetchProgress(): Promise<ProgressResponse> {
  const res = await fetch(`${API_BASE}/team/progress`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatGoal(current: number, goal: number | null): string {
  if (goal == null) return `${current}`;
  return `${current}/${goal}`;
}

function pct(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(100, Math.round((current / goal) * 100));
}

export function TeamProgressCard({ plan }: { plan: SessionUser['plan'] }) {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan !== 'SCALE') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProgress()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar progresso.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plan]);

  if (plan !== 'SCALE') return null;
  if (loading) {
    return (
      <div className="rounded-3xl bg-card border border-border p-6 flex items-center justify-center gap-3 text-muted">
        <Loader2 size={24} className="animate-spin" />
        <span>Carregando suas metas...</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-3xl bg-card border border-border p-6 text-center text-muted text-sm">
        {error ?? 'Não foi possível carregar o progresso.'}
      </div>
    );
  }

  const { goals, today, streak, ranking } = data;
  const hasDailyGoals = goals.dailyLeadsGoal != null || goals.dailyAnalysesGoal != null;

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Target size={16} className="text-emerald-400" /> Suas metas
        </h3>
      </div>
      <div className="p-5 space-y-5">
        {/* Metas do dia com barras */}
        {hasDailyGoals && (
          <div className="space-y-3">
            {goals.dailyLeadsGoal != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Leads hoje</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatGoal(today.searches, goals.dailyLeadsGoal)}
                  </span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${pct(today.searches, goals.dailyLeadsGoal)}%` }}
                  />
                </div>
              </div>
            )}
            {goals.dailyAnalysesGoal != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">Análises hoje</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {formatGoal(today.analyses, goals.dailyAnalysesGoal)}
                  </span>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{ width: `${pct(today.analyses, goals.dailyAnalysesGoal)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {!hasDailyGoals && (
          <p className="text-sm text-muted">Nenhuma meta diária definida. Peça ao gestor para definir metas na equipe.</p>
        )}

        {/* Streak e ranking */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Flame size={18} className="text-amber-400" />
            <span className="text-muted">Sequência:</span>
            <span className="font-semibold text-foreground tabular-nums">{streak} dia(s)</span>
          </div>
          {ranking.total > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy size={18} className="text-amber-400" />
              <span className="text-muted">Você está em</span>
              <span className="font-semibold text-foreground">
                {ranking.position}º de {ranking.total}
              </span>
            </div>
          )}
        </div>

        {/* Top 5 */}
        {ranking.top5.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Top 5 do mês (leads)</p>
            <ol className="space-y-1 text-sm">
              {ranking.top5.map((m, i) => (
                <li key={m.userId} className="flex items-center justify-between">
                  <span className="text-muted">
                    {i + 1}º {m.name}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">{m.monthlySearches}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
