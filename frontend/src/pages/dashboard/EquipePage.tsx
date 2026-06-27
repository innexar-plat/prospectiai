import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, UserPlus, Trophy, AlertCircle, MoreVertical, Pencil, Trash2, LayoutDashboard, Loader2, Target, CreditCard } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { LoadingState, EmptyState } from '@/components/dashboard/shared/DashboardUI';
import { request } from '@/lib/request-helpers';
import { useI18n } from '@/lib/i18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface TeamMember {
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string;
    leadsUsed: number;
    leadsAnalyzed: number;
    actionsLast30d: number;
    joinedAt: string;
    dailyLeadsGoal: number | null;
    dailyAnalysesGoal: number | null;
    monthlyConversionsGoal: number | null;
    limits?: { dailyLeadsLimit: number | null; weeklyLeadsLimit: number | null; monthlyLeadsLimit: number | null };
    usage?: { today: number; week: number; month: number };
}

interface WorkspaceInfo {
    id: string;
    name: string | null;
    plan: string;
    leadsUsed: number;
    leadsLimit: number;
}

interface PendingInvitation {
    id: string;
    email: string;
    createdAt: string;
    lastSentAt: string;
}

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

function TeamDashboardView({ loading, data, t }: { loading: boolean; data: { members: DashboardMember[]; totals: TeamTotals } | null; t: TranslateFn }) {
    if (loading) return <LoadingState message={t('page.equipe.loadingDashboard')} />;
    if (!data) {
        return <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">{t('page.equipe.noDashboardData')}</div>;
    }
    const { totals, members } = data;
    return (
        <>
            <div className="rounded-3xl bg-card border border-border p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                    <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.todayLeads')}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{totals.todayLeads}</p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.todayAnalyses')}</p>
                    <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">{totals.todayAnalyses}</p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.monthLeads')}</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{totals.monthLeads}</p>
                </div>
                <div>
                    <p className="text-xs text-muted uppercase tracking-wider">{t('page.equipe.belowGoal')}</p>
                    <p className="text-2xl font-bold tabular-nums">
                        {totals.belowGoalCount > 0 ? <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertCircle size={20} /> {totals.belowGoalCount}</span> : <span className="text-emerald-600 dark:text-emerald-400">0</span>}
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
                            {[...members].sort((a, b) => b.month.leads - a.month.leads).map((m) => (
                                <tr key={m.memberId} className="border-b border-border/30 hover:bg-surface/50">
                                    <td className="py-3 px-5">
                                        <p className="font-medium text-foreground">{m.name}</p>
                                        <p className="text-[10px] text-muted">{m.email}</p>
                                    </td>
                                    <td className="py-3 px-5 text-right tabular-nums">{m.today.leads} / {m.today.analyses}</td>
                                    <td className="py-3 px-5">
                                        <div className="space-y-1">
                                            {m.goals.dailyLeadsGoal != null && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden max-w-[120px]">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(m.progress.dailyLeadsPct ?? 0, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs text-muted tabular-nums">{m.progress.dailyLeadsPct ?? 0}%</span>
                                                </div>
                                            )}
                                            {m.goals.dailyAnalysesGoal != null && (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden max-w-[120px]">
                                                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(m.progress.dailyAnalysesPct ?? 0, 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs text-muted tabular-nums">{m.progress.dailyAnalysesPct ?? 0}%</span>
                                                </div>
                                            )}
                                            {m.goals.dailyLeadsGoal == null && m.goals.dailyAnalysesGoal == null && <span className="text-muted text-xs">—</span>}
                                        </div>
                                    </td>
                                    <td className="py-3 px-5 text-xs text-muted">
                                        {m.limits && (m.limits.dailyLeadsLimit != null || m.limits.weeklyLeadsLimit != null || m.limits.monthlyLeadsLimit != null) && m.usage ? (
                                            <span className="tabular-nums">
                                                {m.limits.dailyLeadsLimit != null && <span>D: {m.usage.today}/{m.limits.dailyLeadsLimit}</span>}
                                                {m.limits.dailyLeadsLimit != null && (m.limits.weeklyLeadsLimit != null || m.limits.monthlyLeadsLimit != null) && ' · '}
                                                {m.limits.weeklyLeadsLimit != null && <span>S: {m.usage.week}/{m.limits.weeklyLeadsLimit}</span>}
                                                {(m.limits.dailyLeadsLimit != null || m.limits.weeklyLeadsLimit != null) && m.limits.monthlyLeadsLimit != null && ' · '}
                                                {m.limits.monthlyLeadsLimit != null && <span>M: {m.usage.month}/{m.limits.monthlyLeadsLimit}</span>}
                                            </span>
                                        ) : (
                                            <span>—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-5">
                                        {m.goals.monthlyConversionsGoal != null ? (
                                            <span className="tabular-nums">{m.month.actions} / {m.goals.monthlyConversionsGoal} ({m.progress.monthlyConvPct ?? 0}%)</span>
                                        ) : (
                                            <span className="text-muted">—</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-5">
                                        {m.belowGoal ? <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><AlertCircle size={14} /> {t('page.equipe.belowGoalShort')}</span> : <span className="text-muted">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}


function TeamInviteForm({
    t,
    email,
    onEmailChange,
    inviting,
    onSubmit,
}: {
    t: TranslateFn;
    email: string;
    onEmailChange: (v: string) => void;
    inviting: boolean;
    onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
}) {
    return (
        <form onSubmit={onSubmit} className="rounded-3xl bg-card border border-emerald-500/20 p-6 flex flex-col sm:flex-row gap-4">
            <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder={t('page.equipe.inviteEmailPlaceholder')}
                className="flex-1 h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
            />
            <Button
                type="submit"
                variant="primary"
                disabled={inviting || !email.trim()}
                icon={inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 border-0"
            >
                {inviting ? t('page.equipe.inviting') : t('page.equipe.sendInvite')}
            </Button>
        </form>
    );
}

function TeamPendingInvitationsList({
    t,
    invitations,
    resendCooldownMs,
    resendingId,
    onResend,
    nowMs,
}: {
    t: TranslateFn;
    invitations: PendingInvitation[];
    resendCooldownMs: number;
    resendingId: string | null;
    onResend: (id: string) => void;
    nowMs: number;
}) {
    const canResend = (lastSentAt: string) => nowMs - new Date(lastSentAt).getTime() >= resendCooldownMs;
    if (invitations.length === 0) return null;
    return (
        <div className="rounded-3xl bg-card border border-amber-500/20 p-6 flex flex-col gap-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t('page.equipe.pendingInvites')}</h3>
            <ul className="space-y-2">
                {invitations.map((p) => {
                    const cooldown = !canResend(p.lastSentAt);
                    const secondsLeft = cooldown
                        ? Math.ceil((resendCooldownMs - (nowMs - new Date(p.lastSentAt).getTime())) / 1000)
                        : 0;
                    return (
                        <li key={p.id} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                            <span className="text-sm text-foreground">{p.email}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted">{t('page.equipe.inviteSent')}</span>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={cooldown || resendingId === p.id}
                                    onClick={() => onResend(p.id)}
                                    icon={resendingId === p.id ? <Loader2 size={14} className="animate-spin" /> : undefined}
                                    className="min-w-[100px]"
                                >
                                    {(() => {
                                        if (resendingId === p.id) return t('page.equipe.resending');
                                        if (cooldown) return t('page.equipe.resendCooldown', { seconds: secondsLeft });
                                        return t('page.equipe.resend');
                                    })()}
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
            <p className="text-xs text-muted">{t('page.equipe.pendingHint')}</p>
        </div>
    );
}

export default function EquipePage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { t } = useI18n();

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [goalsModalMember, setGoalsModalMember] = useState<TeamMember | null>(null);
    const [goalsForm, setGoalsForm] = useState({ dailyLeadsGoal: '', dailyAnalysesGoal: '', monthlyConversionsGoal: '' });
    const [savingGoals, setSavingGoals] = useState(false);
    const [viewMode, setViewMode] = useState<'ranking' | 'dashboard'>('ranking');
    const [dashboardData, setDashboardData] = useState<{ members: DashboardMember[]; totals: TeamTotals } | null>(null);
    const [loadingDashboard, setLoadingDashboard] = useState(false);
    const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [, setCooldownTick] = useState(0);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
    const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number; width: number; openAbove: boolean; bottom?: number } | null>(null);
    const [editModalMember, setEditModalMember] = useState<TeamMember | null>(null);
    const [editRole, setEditRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
    const [savingRole, setSavingRole] = useState(false);
    const [deleteConfirmMember, setDeleteConfirmMember] = useState<TeamMember | null>(null);
    const [removing, setRemoving] = useState(false);
    const [creditsModalMember, setCreditsModalMember] = useState<TeamMember | null>(null);
    const [creditsForm, setCreditsForm] = useState({ dailyLeadsLimit: '', weeklyLeadsLimit: '', monthlyLeadsLimit: '' });
    const [savingCredits, setSavingCredits] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    const hasAccess = user.plan === 'SCALE';
    const isAdminOrOwner = members.some((m) => m.userId === user.id && (m.role === 'OWNER' || m.role === 'ADMIN'));
    const RESEND_COOLDOWN_MS = 40_000;

    useEffect(() => {
        setNowMs(Date.now());
        const anyCooldown = pendingInvitations.some((p) => Date.now() - new Date(p.lastSentAt).getTime() < RESEND_COOLDOWN_MS);
        if (!anyCooldown) return;
        const t = setInterval(() => {
            setCooldownTick((n) => n + 1);
            setNowMs(Date.now());
        }, 1000);
        return () => clearInterval(t);
    }, [pendingInvitations]);

    const closeActionsMenu = () => {
        setActionsOpenId(null);
        setActionsMenuPosition(null);
    };

    useEffect(() => {
        if (!actionsOpenId) return;
        const onOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (actionsRef.current?.contains(target)) return;
            const portal = document.getElementById('team-actions-portal');
            if (portal?.contains(target)) return;
            closeActionsMenu();
        };
        document.addEventListener('click', onOutside);
        return () => document.removeEventListener('click', onOutside);
    }, [actionsOpenId]);

    useEffect(() => {
        if (!actionsOpenId) return;
        const onScrollOrResize = () => closeActionsMenu();
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
        return () => {
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
        };
    }, [actionsOpenId]);

    useEffect(() => {
        if (!hasAccess) { setLoading(false); return; }
        let cancelled = false;
        request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team')
            .then((data) => {
                if (!cancelled) {
                    setMembers(data.members);
                    setWorkspace(data.workspace);
                    setPendingInvitations(data.pendingInvitations ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) addToast('error', t('page.equipe.toast.loadError'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [hasAccess, addToast]);

    useEffect(() => {
        if (!hasAccess || !isAdminOrOwner || viewMode !== 'dashboard') return;
        let cancelled = false;
        setLoadingDashboard(true);
        request<{ members: DashboardMember[]; totals: TeamTotals }>('/team/dashboard')
            .then((data) => {
                if (!cancelled) setDashboardData(data);
            })
            .catch(() => {
                if (!cancelled) addToast('error', t('page.equipe.toast.dashboardLoadError'));
            })
            .finally(() => {
                if (!cancelled) setLoadingDashboard(false);
            });
        return () => { cancelled = true; };
    }, [hasAccess, isAdminOrOwner, viewMode, addToast]);

    const handleInvite = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviting(true);
        try {
            const res = await request<{ ok: boolean; pendingInvite?: PendingInvitation; accountCreated?: boolean }>('/team', { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim() }) });
            if (res.accountCreated) {
                addToast('success', t('page.equipe.toast.inviteAccountCreated', { email: inviteEmail }));
            } else {
                addToast('success', t('page.equipe.toast.invitePending', { email: inviteEmail }));
            }
            setInviteEmail('');
            setShowInvite(false);
            if (res.pendingInvite) {
                const invite = res.pendingInvite;
                setPendingInvitations((prev) => invite ? [invite, ...prev.filter((p) => p.email !== invite.email)] : prev);
            }
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            setPendingInvitations(data.pendingInvitations ?? []);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.inviteError'));
        } finally {
            setInviting(false);
        }
    };

    const handleResendInvite = async (invitationId: string) => {
        setResendingId(invitationId);
        try {
            await request<{ ok: boolean; lastSentAt: string }>('/team/invite/resend', {
                method: 'POST',
                body: JSON.stringify({ invitationId }),
            });
            addToast('success', t('page.equipe.toast.resendSuccess'));
            setPendingInvitations((prev) =>
                prev.map((p) =>
                    p.id === invitationId ? { ...p, lastSentAt: new Date().toISOString() } : p
                )
            );
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.resendError'));
        } finally {
            setResendingId(null);
        }
    };

    const openGoalsModal = (m: TeamMember) => {
        setGoalsModalMember(m);
        setGoalsForm({
            dailyLeadsGoal: m.dailyLeadsGoal != null ? String(m.dailyLeadsGoal) : '',
            dailyAnalysesGoal: m.dailyAnalysesGoal != null ? String(m.dailyAnalysesGoal) : '',
            monthlyConversionsGoal: m.monthlyConversionsGoal != null ? String(m.monthlyConversionsGoal) : '',
        });
    };

    const openCreditsModal = (m: TeamMember) => {
        setCreditsModalMember(m);
        setCreditsForm({
            dailyLeadsLimit: m.limits?.dailyLeadsLimit != null ? String(m.limits.dailyLeadsLimit) : '',
            weeklyLeadsLimit: m.limits?.weeklyLeadsLimit != null ? String(m.limits.weeklyLeadsLimit) : '',
            monthlyLeadsLimit: m.limits?.monthlyLeadsLimit != null ? String(m.limits.monthlyLeadsLimit) : '',
        });
    };

    const handleSaveCredits = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!creditsModalMember) return;
        setSavingCredits(true);
        try {
            await request('/team/credits', {
                method: 'PUT',
                body: JSON.stringify({
                    memberId: creditsModalMember.id,
                    dailyLeadsLimit: creditsForm.dailyLeadsLimit === '' ? null : parseInt(creditsForm.dailyLeadsLimit, 10),
                    weeklyLeadsLimit: creditsForm.weeklyLeadsLimit === '' ? null : parseInt(creditsForm.weeklyLeadsLimit, 10),
                    monthlyLeadsLimit: creditsForm.monthlyLeadsLimit === '' ? null : parseInt(creditsForm.monthlyLeadsLimit, 10),
                }),
            });
            addToast('success', t('page.equipe.toast.creditsUpdated'));
            setCreditsModalMember(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            if (data.pendingInvitations != null) setPendingInvitations(data.pendingInvitations);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.creditsError'));
        } finally {
            setSavingCredits(false);
        }
    };

    const handleSaveGoals = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!goalsModalMember) return;
        setSavingGoals(true);
        try {
            await request('/team/goals', {
                method: 'PUT',
                body: JSON.stringify({
                    memberId: goalsModalMember.id,
                    dailyLeadsGoal: goalsForm.dailyLeadsGoal === '' ? null : parseInt(goalsForm.dailyLeadsGoal, 10),
                    dailyAnalysesGoal: goalsForm.dailyAnalysesGoal === '' ? null : parseInt(goalsForm.dailyAnalysesGoal, 10),
                    monthlyConversionsGoal: goalsForm.monthlyConversionsGoal === '' ? null : parseInt(goalsForm.monthlyConversionsGoal, 10),
                }),
            });
            addToast('success', t('page.equipe.toast.goalsUpdated'));
            setGoalsModalMember(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo }>('/team');
            setMembers(data.members);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.goalsError'));
        } finally {
            setSavingGoals(false);
        }
    };

    const handleSaveRole = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editModalMember) return;
        setSavingRole(true);
        try {
            await request('/team/role', {
                method: 'PUT',
                body: JSON.stringify({ memberId: editModalMember.id, role: editRole }),
            });
            addToast('success', t('page.equipe.toast.roleUpdated'));
            setEditModalMember(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            if (data.pendingInvitations != null) setPendingInvitations(data.pendingInvitations);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.roleError'));
        } finally {
            setSavingRole(false);
        }
    };

    const handleRemoveMember = async () => {
        if (!deleteConfirmMember) return;
        setRemoving(true);
        try {
            await request('/team/remove', {
                method: 'DELETE',
                body: JSON.stringify({ userIdToRemove: deleteConfirmMember.userId }),
            });
            addToast('success', t('page.equipe.toast.memberRemoved'));
            setDeleteConfirmMember(null);
            setActionsOpenId(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            if (data.pendingInvitations != null) setPendingInvitations(data.pendingInvitations);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : t('page.equipe.toast.removeError'));
        } finally {
            setRemoving(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title={t('page.equipe.title')} subtitle={t('page.equipe.subtitle')} breadcrumb={t('page.equipe.breadcrumb')} />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <EmptyState
                        icon={Lock}
                        title={t('page.equipe.lockedTitle')}
                        description={t('page.equipe.lockedDesc')}
                        actionLabel={t('page.equipe.upgrade')}
                        onAction={() => navigate('/dashboard/configuracoes')}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title={t('page.equipe.title')} subtitle={t('page.equipe.subtitleMembers', { count: members.length })} breadcrumb={t('page.equipe.breadcrumb')} />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {/* Workspace Overview */}
                {workspace && (
                    <div className="rounded-3xl bg-card border border-border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{workspace.name || t('page.equipe.myWorkspace')}</h2>
                            <p className="text-xs text-muted mt-1">{t('page.equipe.planCredits', { plan: workspace.plan, used: workspace.leadsUsed, limit: workspace.leadsLimit })}</p>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={<UserPlus size={16} />}
                            onClick={() => setShowInvite(!showInvite)}
                            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-500/25 border-0"
                        >
                            {t('page.equipe.invite')}
                        </Button>
                    </div>
                )}

                {showInvite && (
                    <TeamInviteForm
                        t={t}
                        email={inviteEmail}
                        onEmailChange={setInviteEmail}
                        inviting={inviting}
                        onSubmit={handleInvite}
                    />
                )}

                <TeamPendingInvitationsList
                    t={t}
                    invitations={pendingInvitations}
                    resendCooldownMs={RESEND_COOLDOWN_MS}
                    resendingId={resendingId}
                    onResend={handleResendInvite}
                    nowMs={nowMs}
                />

                {loading ? (
                    <LoadingState message={t('page.equipe.loadingTeam')} />
                ) : (
                    <>
                        {isAdminOrOwner && (
                            <div className="flex gap-2 p-1 rounded-xl bg-surface border border-border w-fit">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('ranking')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'ranking' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-foreground'}`}
                                >
                                    <Trophy size={14} className="inline mr-2 align-middle" /> {t('page.equipe.ranking')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('dashboard')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-foreground'}`}
                                >
                                    <LayoutDashboard size={14} className="inline mr-2 align-middle" /> {t('page.equipe.dashboard')}
                                </button>
                            </div>
                        )}

                        {viewMode === 'dashboard' && isAdminOrOwner ? (
                            <div className="space-y-6">
                                <TeamDashboardView loading={loadingDashboard} data={dashboardData} t={t} />
                            </div>
                        ) : (
                            <>
                                {/* Team Members Table */}
                                <div className="rounded-3xl bg-card border border-border overflow-hidden">
                                    <div className="p-5 border-b border-border">
                                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Trophy size={16} className="text-amber-600 dark:text-amber-400" />{t('page.equipe.teamRanking')}
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border text-left">
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">#</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.equipe.col.member')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.equipe.col.role')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.leads')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.analyses')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.actions30d')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.goalLeadsDay')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.goalAnalysesDay')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.goalConversionsMonth')}</th>
                                                    <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">{t('page.equipe.col.usageLimit')}</th>
                                                    {isAdminOrOwner && <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">{t('page.equipe.col.actions')}</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...members]
                                                    .sort((a, b) => b.leadsAnalyzed - a.leadsAnalyzed)
                                                    .map((m, i) => (
                                                        <tr key={m.id} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                                                            <td className="py-3 px-5">
                                                                <span className={`w-7 h-7 inline-flex items-center justify-center rounded-lg font-bold text-xs ${i < 3 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-surface text-muted'}`}>
                                                                    {i + 1}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-5">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center font-semibold text-xs text-violet-600 dark:text-violet-400 shrink-0">
                                                                        {m.name?.[0] || m.email?.[0] || '?'}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-foreground">{m.name || t('page.equipe.noName')}</p>
                                                                        <p className="text-[10px] text-muted">{m.email}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-5">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.role === 'OWNER' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' : 'bg-surface text-muted'
                                                                    }`}>
                                                                    {m.role}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-5 text-right tabular-nums font-bold text-foreground">{m.leadsUsed}</td>
                                                            <td className="py-3 px-5 text-right tabular-nums font-bold text-violet-600 dark:text-violet-400">{m.leadsAnalyzed}</td>
                                                            <td className="py-3 px-5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{m.actionsLast30d}</td>
                                                            <td className="py-3 px-5 text-right tabular-nums text-muted">{m.dailyLeadsGoal ?? '-'}</td>
                                                            <td className="py-3 px-5 text-right tabular-nums text-muted">{m.dailyAnalysesGoal ?? '-'}</td>
                                                            <td className="py-3 px-5 text-right tabular-nums text-muted">{m.monthlyConversionsGoal ?? '-'}</td>
                                                            <td className="py-3 px-5 text-right text-xs text-muted tabular-nums">
                                                                {m.limits && (m.limits.dailyLeadsLimit != null || m.limits.weeklyLeadsLimit != null || m.limits.monthlyLeadsLimit != null) && m.usage
                                                                    ? `${m.usage.today}/${m.limits.dailyLeadsLimit ?? '-'} · ${m.usage.week}/${m.limits.weeklyLeadsLimit ?? '-'} · ${m.usage.month}/${m.limits.monthlyLeadsLimit ?? '-'}`
                                                                    : '—'}
                                                            </td>
                                                            {isAdminOrOwner && (
                                                                <td className="py-3 px-5">
                                                                    <div className="flex justify-start" ref={actionsOpenId === m.id ? actionsRef : undefined}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (actionsOpenId === m.id) {
                                                                                    closeActionsMenu();
                                                                                    return;
                                                                                }
                                                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                                                const spaceBelow = window.innerHeight - rect.bottom;
                                                                                const menuHeightApprox = 150;
                                                                                const openAbove = spaceBelow < menuHeightApprox;
                                                                                setActionsMenuPosition({
                                                                                    top: rect.bottom + 4,
                                                                                    left: rect.left,
                                                                                    width: rect.width,
                                                                                    openAbove,
                                                                                    ...(openAbove && { bottom: window.innerHeight - rect.top + 4 }),
                                                                                });
                                                                                setActionsOpenId(m.id);
                                                                            }}
                                                                            className="p-2 rounded-lg border border-border bg-surface hover:bg-surface/80 text-muted hover:text-foreground transition-colors"
                                                                            aria-label={t('page.equipe.actionsAria')}
                                                                        >
                                                                            <MoreVertical size={18} />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {/* Goals modal — responsivo, sem scroll horizontal */}
                {goalsModalMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto" onClick={() => !savingGoals && setGoalsModalMember(null)}>
                        <div className="my-auto w-full max-w-md rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{t('page.equipe.goalsTitle', { name: goalsModalMember.name || goalsModalMember.email })}</h3>
                            <p className="text-xs text-muted mb-3 sm:mb-4">{t('page.equipe.goalsDesc')}</p>
                            <form onSubmit={handleSaveGoals} className="space-y-3 sm:space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.goalLeadsDay')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={500}
                                        value={goalsForm.dailyLeadsGoal}
                                        onChange={(e) => setGoalsForm((f) => ({ ...f, dailyLeadsGoal: e.target.value }))}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.goalAnalysesDay')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={200}
                                        value={goalsForm.dailyAnalysesGoal}
                                        onChange={(e) => setGoalsForm((f) => ({ ...f, dailyAnalysesGoal: e.target.value }))}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.goalConversionsMonth')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={1000}
                                        value={goalsForm.monthlyConversionsGoal}
                                        onChange={(e) => setGoalsForm((f) => ({ ...f, monthlyConversionsGoal: e.target.value }))}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setGoalsModalMember(null)}
                                        disabled={savingGoals}
                                        className="w-full sm:flex-1"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={savingGoals}
                                        icon={savingGoals ? <Loader2 size={16} className="animate-spin" /> : undefined}
                                        className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0"
                                    >
                                        {savingGoals ? t('page.equipe.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Credits limits modal */}
                {creditsModalMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto" onClick={() => !savingCredits && setCreditsModalMember(null)}>
                        <div className="my-auto w-full max-w-md rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl p-4 sm:p-6 max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{t('page.equipe.creditsTitle', { name: creditsModalMember.name || creditsModalMember.email })}</h3>
                            <p className="text-xs text-muted mb-3 sm:mb-4">{t('page.equipe.creditsDesc', { today: creditsModalMember.usage?.today ?? 0, week: creditsModalMember.usage?.week ?? 0, month: creditsModalMember.usage?.month ?? 0 })}</p>
                            <form onSubmit={handleSaveCredits} className="space-y-3 sm:space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.dailyLimit')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={creditsForm.dailyLeadsLimit}
                                        onChange={(e) => setCreditsForm((f) => ({ ...f, dailyLeadsLimit: e.target.value }))}
                                        placeholder={t('page.equipe.noLimit')}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.weeklyLimit')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={creditsForm.weeklyLeadsLimit}
                                        onChange={(e) => setCreditsForm((f) => ({ ...f, weeklyLeadsLimit: e.target.value }))}
                                        placeholder={t('page.equipe.noLimit')}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.monthlyLimit')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={creditsForm.monthlyLeadsLimit}
                                        onChange={(e) => setCreditsForm((f) => ({ ...f, monthlyLeadsLimit: e.target.value }))}
                                        placeholder={t('page.equipe.noLimit')}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    />
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                                    <Button type="button" variant="secondary" onClick={() => setCreditsModalMember(null)} disabled={savingCredits} className="w-full sm:flex-1">{t('common.cancel')}</Button>
                                    <Button type="submit" variant="primary" disabled={savingCredits} icon={savingCredits ? <Loader2 size={16} className="animate-spin" /> : undefined} className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0">
                                        {savingCredits ? t('page.equipe.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit role modal — responsivo */}
                {editModalMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto" onClick={() => !savingRole && setEditModalMember(null)}>
                        <div className="my-auto w-full max-w-sm rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{t('page.equipe.editRoleTitle', { name: editModalMember.name || editModalMember.email })}</h3>
                            <p className="text-xs text-muted mb-3 sm:mb-4">{t('page.equipe.editRoleDesc')}</p>
                            <form onSubmit={handleSaveRole} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">{t('page.equipe.role')}</label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value as 'MEMBER' | 'ADMIN')}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    >
                                        <option value="MEMBER">{t('page.equipe.role.member')}</option>
                                        {members.some((x) => x.userId === user.id && x.role === 'OWNER') && <option value="ADMIN">{t('page.equipe.role.admin')}</option>}
                                    </select>
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                                    <Button type="button" variant="secondary" onClick={() => setEditModalMember(null)} disabled={savingRole} className="w-full sm:flex-1">{t('common.cancel')}</Button>
                                    <Button type="submit" variant="primary" disabled={savingRole} icon={savingRole ? <Loader2 size={16} className="animate-spin" /> : undefined} className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0">
                                        {savingRole ? t('page.equipe.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Delete confirm modal — responsivo */}
                {deleteConfirmMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto" onClick={() => !removing && setDeleteConfirmMember(null)}>
                        <div className="my-auto w-full max-w-sm rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">{t('page.equipe.removeTitle')}</h3>
                            <p className="text-sm text-muted mb-4">
                                {t('page.equipe.removeDesc', { name: deleteConfirmMember.name || deleteConfirmMember.email })}
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                                <Button type="button" variant="secondary" onClick={() => setDeleteConfirmMember(null)} disabled={removing} className="w-full sm:flex-1">{t('common.cancel')}</Button>
                                <Button type="button" variant="primary" onClick={handleRemoveMember} disabled={removing} icon={removing ? <Loader2 size={16} className="animate-spin" /> : undefined} className="w-full sm:flex-1 bg-destructive hover:bg-destructive/90 border-0 text-destructive-foreground">
                                    {removing ? t('page.equipe.removing') : t('page.equipe.remove')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Menu de ações em portal (não cortado pelo overflow da tabela) */}
                {actionsOpenId && actionsMenuPosition && typeof document !== 'undefined' && (() => {
                    const m = members.find((x) => x.id === actionsOpenId);
                    if (!m) return null;
                    const left = Math.min(actionsMenuPosition.left, window.innerWidth - 180);
                    const style = actionsMenuPosition.openAbove && actionsMenuPosition.bottom != null
                        ? { bottom: actionsMenuPosition.bottom, left }
                        : { top: actionsMenuPosition.top, left };
                    return createPortal(
                        <div
                            id="team-actions-portal"
                            className="fixed z-[100] min-w-[160px] rounded-xl border border-border bg-card shadow-xl py-1"
                            style={style}
                        >
                            <button
                                type="button"
                                className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface flex items-center gap-2"
                                onClick={() => { openGoalsModal(m); closeActionsMenu(); }}
                            >
                                <Target size={14} className="text-amber-500 shrink-0" /> {t('page.equipe.menu.goals')}
                            </button>
                            <button
                                type="button"
                                className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface flex items-center gap-2"
                                onClick={() => { openCreditsModal(m); closeActionsMenu(); }}
                            >
                                <CreditCard size={14} className="text-emerald-500 shrink-0" /> {t('page.equipe.menu.credits')}
                            </button>
                            {m.role !== 'OWNER' && (
                                <>
                                    <button
                                        type="button"
                                        className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface flex items-center gap-2"
                                        onClick={() => { setEditModalMember(m); setEditRole(m.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'); closeActionsMenu(); }}
                                    >
                                        <Pencil size={14} className="text-violet-600 dark:text-violet-400 shrink-0" /> {t('page.equipe.menu.editRole')}
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                                        onClick={() => { setDeleteConfirmMember(m); closeActionsMenu(); }}
                                    >
                                        <Trash2 size={14} className="shrink-0" /> {t('page.equipe.remove')}
                                    </button>
                                </>
                            )}
                        </div>,
                        document.body
                    );
                })()}
            </div>
        </>
    );
}
