import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface DashboardMember {
  memberId: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  role: string;
  goals: { dailyLeadsGoal: number | null; dailyAnalysesGoal: number | null; monthlyConversionsGoal: number | null };
  limits?: { dailyLeadsLimit: number | null; weeklyLeadsLimit: number | null; monthlyLeadsLimit: number | null };
  today: { leads: number; analyses: number };
  month: { leads: number; analyses: number; actions: number };
  usage?: { today: number; week: number; month: number };
  progress: { dailyLeadsPct: number | null; dailyAnalysesPct: number | null; monthlyConvPct: number | null };
  belowGoal: boolean;
}

interface TeamTotals {
  todayLeads: number;
  todayAnalyses: number;
  monthLeads: number;
  monthAnalyses: number;
  monthActions: number;
  membersCount: number;
  belowGoalCount: number;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function EquipeDashboardPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const { t } = useI18n();

  const [dashboardData, setDashboardData] = useState<{
    members: DashboardMember[];
    totals: TeamTotals;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasAccess = user.plan === 'SCALE';

  useEffect(() => {
    if (!hasAccess) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => setLoading(true));
    queueMicrotask(() => setError(null));
    request<{ members: DashboardMember[]; totals: TeamTotals }>('/team/dashboard')
      .then((data) => {
        if (!cancelled) setDashboardData(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : t('page.equipeDashboard.loadError');
          setError(msg);
          if (msg.includes('403') || msg.includes('Only admins')) {
            addToast('error', t('page.equipeDashboard.toast.accessDenied'));
          } else {
            addToast('error', msg);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasAccess, addToast, t]);

  if (!hasAccess) {
    return (
      <>
        <HeaderDashboard
          title={t('page.equipeDashboard.title')}
          subtitle={t('page.equipeDashboard.subtitleLocked')}
          breadcrumb={t('page.equipeDashboard.breadcrumb')}
        />
        <div className="p-6 sm:p-8 max-w-6xl mx-auto">
          <div className="rounded-3xl bg-card border border-border p-12 text-center text-muted">
            {t('page.equipeDashboard.upgrade')}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderDashboard
        title={t('page.equipeDashboard.title')}
        subtitle={t('page.equipeDashboard.subtitle')}
        breadcrumb={t('page.equipeDashboard.breadcrumb')}
      />
      <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
        {(() => {
          if (loading) {
            return (
              <div className="flex items-center justify-center p-12 text-muted gap-3">
                <Loader2 size={24} className="animate-spin" />
                <span>{t('page.equipeDashboard.loading')}</span>
              </div>
            );
          }
          if (error) {
            const errorMessage = error.includes('403') || error.includes('Only admins')
              ? t('page.equipeDashboard.toast.accessDenied')
              : error;
            return (
              <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">
                {errorMessage}
              </div>
            );
          }
          if (!dashboardData) {
            return (
              <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">
                {t('page.equipeDashboard.noData')}
              </div>
            );
          }
          return (
          <>
            <div className="rounded-3xl bg-card border border-border p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.todayLeads')}</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{dashboardData.totals.todayLeads}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.todayAnalyses')}</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">{dashboardData.totals.todayAnalyses}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.monthLeads')}</p>
                <p className="text-2xl font-bold text-foreground tabular-nums">{dashboardData.totals.monthLeads}</p>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.belowGoal')}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {dashboardData.totals.belowGoalCount > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle size={20} /> {dashboardData.totals.belowGoalCount}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">0</span>
                  )}
                </p>
              </div>
            </div>
            <div className="rounded-3xl bg-card border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.equipe.goalVsActual')}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">{t('page.equipe.col.member')}</th>
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase text-right">{t('page.equipe.col.todayLa')}</th>
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">{t('page.equipe.col.goalVsDay')}</th>
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">{t('page.equipe.col.usageVsLimit')}</th>
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">{t('page.equipe.col.monthConversions')}</th>
                      <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase w-20">{t('page.equipe.col.alert')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dashboardData.members]
                      .sort((a, b) => b.month.leads - a.month.leads)
                      .map((m) => (
                        <tr key={m.memberId} className="border-b border-border/30 hover:bg-surface/50">
                          <td className="py-3 px-5">
                            <p className="font-medium text-foreground">{m.name}</p>
                            <p className="text-[10px] text-muted">{m.email}</p>
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums">
                            {m.today.leads} / {m.today.analyses}
                          </td>
                          <td className="py-3 px-5">
                            <div className="space-y-1">
                              {m.goals.dailyLeadsGoal != null && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden max-w-[120px]">
                                    <div
                                      className="h-full bg-emerald-500 rounded-full"
                                      style={{ width: `${Math.min(m.progress.dailyLeadsPct ?? 0, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted tabular-nums">{m.progress.dailyLeadsPct ?? 0}%</span>
                                </div>
                              )}
                              {m.goals.dailyAnalysesGoal != null && (
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden max-w-[120px]">
                                    <div
                                      className="h-full bg-violet-500 rounded-full"
                                      style={{ width: `${Math.min(m.progress.dailyAnalysesPct ?? 0, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted tabular-nums">{m.progress.dailyAnalysesPct ?? 0}%</span>
                                </div>
                              )}
                              {m.goals.dailyLeadsGoal == null && m.goals.dailyAnalysesGoal == null && (
                                <span className="text-muted text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5 text-xs text-muted tabular-nums">
                            {m.limits && (m.limits.dailyLeadsLimit != null || m.limits.weeklyLeadsLimit != null || m.limits.monthlyLeadsLimit != null) && m.usage ? (
                              <>D: {m.usage.today}/{m.limits.dailyLeadsLimit ?? '-'} · S: {m.usage.week}/{m.limits.weeklyLeadsLimit ?? '-'} · M: {m.usage.month}/{m.limits.monthlyLeadsLimit ?? '-'}</>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-5">
                            {m.goals.monthlyConversionsGoal != null ? (
                              <span className="tabular-nums">
                                {m.month.actions} / {m.goals.monthlyConversionsGoal} ({m.progress.monthlyConvPct ?? 0}%)
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="py-3 px-5">
                            {m.belowGoal ? (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle size={14} /> {t('page.equipe.belowGoalShort')}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
          );
        })()}
      </div>
    </>
  );
}
