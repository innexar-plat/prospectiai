import { useState, useEffect } from 'react';
import { Target, Loader2, Trophy, Flame, CreditCard } from 'lucide-react';
import type { SessionUser } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ProgressResponse {
  goals: {
    dailyLeadsGoal: number | null;
    dailyAnalysesGoal: number | null;
    monthlyConversionsGoal: number | null;
  };
  limits?: {
    dailyLeadsLimit: number | null;
    weeklyLeadsLimit: number | null;
    monthlyLeadsLimit: number | null;
  };
  usage?: { today: number; week: number; month: number };
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
  const { t } = useI18n();
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan !== 'SCALE') {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    fetchProgress()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('common.teamProgress.loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plan, t]);

  if (plan !== 'SCALE') return null;
  if (loading) {
    return (
      <div className="rounded-3xl bg-card border border-border p-6 flex items-center justify-center gap-3 text-muted">
        <Loader2 size={24} className="animate-spin" />
        <span>{t('common.teamProgress.loading')}</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-3xl bg-card border border-border p-6 text-center text-muted text-sm">
        {error ?? t('common.teamProgress.unavailable')}
      </div>
    );
  }

  const { goals, limits, usage, today, streak, ranking } = data;
  const hasDailyGoals = goals.dailyLeadsGoal != null || goals.dailyAnalysesGoal != null;
  const hasLimits = limits && (limits.dailyLeadsLimit != null || limits.weeklyLeadsLimit != null || limits.monthlyLeadsLimit != null);

  return (
    <div className="rounded-3xl bg-card border border-border overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Target size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('common.teamProgress.title')}
        </h3>
      </div>
      <div className="p-5 space-y-5">
        {hasLimits && usage && (
          <div className="space-y-2 pb-3 border-b border-border/50">
            <p className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-2">
              <CreditCard size={14} className="text-emerald-600 dark:text-emerald-400" /> {t('common.teamProgress.quota')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              {limits.dailyLeadsLimit != null && (
                <div className="rounded-lg bg-surface/50 px-3 py-2">
                  <span className="text-muted">{t('common.teamProgress.today')}</span>
                  <p className="font-semibold text-foreground tabular-nums">{usage.today} / {limits.dailyLeadsLimit}</p>
                </div>
              )}
              {limits.weeklyLeadsLimit != null && (
                <div className="rounded-lg bg-surface/50 px-3 py-2">
                  <span className="text-muted">{t('common.teamProgress.week')}</span>
                  <p className="font-semibold text-foreground tabular-nums">{usage.week} / {limits.weeklyLeadsLimit}</p>
                </div>
              )}
              {limits.monthlyLeadsLimit != null && (
                <div className="rounded-lg bg-surface/50 px-3 py-2">
                  <span className="text-muted">{t('common.teamProgress.month')}</span>
                  <p className="font-semibold text-foreground tabular-nums">{usage.month} / {limits.monthlyLeadsLimit}</p>
                </div>
              )}
            </div>
          </div>
        )}
        {hasDailyGoals && (
          <div className="space-y-3">
            {goals.dailyLeadsGoal != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted">{t('common.teamProgress.leadsToday')}</span>
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
                  <span className="text-muted">{t('common.teamProgress.analysesToday')}</span>
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
          <p className="text-sm text-muted">{t('common.teamProgress.noDailyGoals')}</p>
        )}

        <div className="flex flex-wrap gap-4 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm">
            <Flame size={18} className="text-amber-600 dark:text-amber-400" />
            <span className="text-muted">{t('common.teamProgress.streak')}</span>
            <span className="font-semibold text-foreground tabular-nums">{t('common.teamProgress.streakDays', { count: streak })}</span>
          </div>
          {ranking.total > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Trophy size={18} className="text-amber-600 dark:text-amber-400" />
              <span className="text-muted">{t('common.teamProgress.rankingYou')}</span>
              <span className="font-semibold text-foreground">
                {t('common.teamProgress.rankingOf', { position: ranking.position, total: ranking.total })}
              </span>
            </div>
          )}
        </div>

        {ranking.top5.length > 0 && (
          <div className="pt-2">
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{t('common.teamProgress.top5')}</p>
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
