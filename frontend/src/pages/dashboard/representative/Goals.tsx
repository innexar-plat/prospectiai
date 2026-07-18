import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Loader2, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type CurrentGoal = { targetCents: number; achievedCents: number; percent: number };

export default function RepGoals() {
  useOutletContext<{ user: SessionUser }>();
  const [goal, setGoal] = useState<CurrentGoal | null>(null);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    representativeApi.getDashboard()
      .then((data) => { setGoal(data.dashboard.goalProgress); setCurrency(data.currency); })
      .catch(() => setGoal(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Metas" breadcrumb="Representante" />
        <div className="flex items-center gap-2 text-muted py-8 px-6">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Metas" breadcrumb="Representante" />
        <div className="p-6 text-muted">Nenhuma meta definida para este mês.</div>
      </div>
    );
  }

  const now = new Date();
  const pct = Math.min(100, goal.percent);
  const exceeded = goal.achievedCents >= goal.targetCents;
  const symbol = currency === 'USD' ? '$' : 'R$';
  const formatMoney = (cents: number) => `${symbol} ${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Metas Mensais" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-4 max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                exceeded ? 'bg-amber-500/20' : 'bg-violet-500/10'
              )}>
                {exceeded ? <Trophy className="w-5 h-5 text-amber-500" /> : <Target className="w-5 h-5 text-violet-500" />}
              </div>
              <div>
                <h3 className="font-bold text-foreground">
                  Meta {String(now.getMonth() + 1).padStart(2, '0')}/{now.getFullYear()}
                </h3>
                <p className={cn(
                  'text-xs font-semibold',
                  exceeded ? 'text-amber-500' : 'text-muted'
                )}>
                  {exceeded ? 'Meta atingida!' : `Faltam ${formatMoney(Math.max(0, goal.targetCents - goal.achievedCents))}`}
                </p>
              </div>
            </div>
            <span className="text-2xl font-black text-foreground tabular-nums">{pct}%</span>
          </div>

          <div className="h-4 w-full bg-surface rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                exceeded
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex justify-between mt-3 text-sm">
            <span className="text-muted">
              <span className="font-semibold text-foreground">{formatMoney(goal.achievedCents)}</span> alcançados
            </span>
            <span className="text-muted">
              Meta: <span className="font-semibold text-foreground">{formatMoney(goal.targetCents)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
