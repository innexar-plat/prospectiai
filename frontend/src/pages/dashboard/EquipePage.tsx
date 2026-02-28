import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Loader2, UserPlus, Trophy, Target, LayoutDashboard, AlertCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { useOutletContext, useNavigate } from 'react-router-dom';
import type { SessionUser } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
    today: { leads: number; analyses: number };
    month: { leads: number; analyses: number; actions: number };
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
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function EquipePage() {
    const { user } = useOutletContext<{ user: SessionUser }>();
    const navigate = useNavigate();
    const { addToast } = useToast();

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
    const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
    const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number; width: number; openAbove: boolean; bottom?: number } | null>(null);
    const [editModalMember, setEditModalMember] = useState<TeamMember | null>(null);
    const [editRole, setEditRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
    const [savingRole, setSavingRole] = useState(false);
    const [deleteConfirmMember, setDeleteConfirmMember] = useState<TeamMember | null>(null);
    const [removing, setRemoving] = useState(false);
    const actionsRef = useRef<HTMLDivElement>(null);

    const hasAccess = user.plan === 'SCALE';
    const isAdminOrOwner = members.some((m) => m.userId === user.id && (m.role === 'OWNER' || m.role === 'ADMIN'));
    const RESEND_COOLDOWN_MS = 40_000;

    useEffect(() => {
        const anyCooldown = pendingInvitations.some((p) => Date.now() - new Date(p.lastSentAt).getTime() < RESEND_COOLDOWN_MS);
        if (!anyCooldown) return;
        const t = setInterval(() => setCooldownTick((n) => n + 1), 1000);
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
                if (!cancelled) addToast('error', 'Falha ao carregar a equipe.');
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
                if (!cancelled) addToast('error', 'Falha ao carregar dashboard da equipe.');
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
            const res = await request<{ ok: boolean; pendingInvite: PendingInvitation }>('/team', { method: 'POST', body: JSON.stringify({ email: inviteEmail.trim() }) });
            addToast('success', `Convite enviado para ${inviteEmail}. A pessoa só entra na equipe após aceitar.`);
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
            addToast('error', err instanceof Error ? err.message : 'Erro ao convidar.');
        } finally {
            setInviting(false);
        }
    };

    const canResend = (lastSentAt: string) => Date.now() - new Date(lastSentAt).getTime() >= RESEND_COOLDOWN_MS;

    const handleResendInvite = async (invitationId: string) => {
        setResendingId(invitationId);
        try {
            await request<{ ok: boolean; lastSentAt: string }>('/team/invite/resend', {
                method: 'POST',
                body: JSON.stringify({ invitationId }),
            });
            addToast('success', 'Convite reenviado.');
            setPendingInvitations((prev) =>
                prev.map((p) =>
                    p.id === invitationId ? { ...p, lastSentAt: new Date().toISOString() } : p
                )
            );
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao reenviar.');
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
            addToast('success', 'Metas atualizadas.');
            setGoalsModalMember(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo }>('/team');
            setMembers(data.members);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao salvar metas.');
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
            addToast('success', 'Função atualizada.');
            setEditModalMember(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            if (data.pendingInvitations != null) setPendingInvitations(data.pendingInvitations);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao atualizar função.');
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
            addToast('success', 'Membro removido da equipe.');
            setDeleteConfirmMember(null);
            setActionsOpenId(null);
            const data = await request<{ members: TeamMember[]; workspace: WorkspaceInfo; pendingInvitations: PendingInvitation[] }>('/team');
            setMembers(data.members);
            if (data.pendingInvitations != null) setPendingInvitations(data.pendingInvitations);
        } catch (err: unknown) {
            addToast('error', err instanceof Error ? err.message : 'Erro ao remover.');
        } finally {
            setRemoving(false);
        }
    };

    if (!hasAccess) {
        return (
            <>
                <HeaderDashboard title="Gestão de Equipe" subtitle="Convide vendedores, defina metas e acompanhe performance." breadcrumb="Dashboard / Equipe" />
                <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full">
                    <div className="rounded-[2.4rem] bg-gradient-to-br from-emerald-900/30 via-violet-900/20 to-background border border-emerald-500/20 p-12 flex flex-col items-center justify-center gap-6 min-h-[400px] text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-500/10 blur-[100px] -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" />
                        <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative z-10">
                            <Lock size={32} className="text-emerald-400" />
                        </div>
                        <div className="space-y-2 relative z-10 max-w-xl">
                            <h2 className="text-2xl font-black text-foreground">Gestão de Equipe</h2>
                            <p className="text-muted leading-relaxed">
                                Convide vendedores por email, acompanhe as ações de cada membro,
                                defina <span className="text-emerald-400 font-bold">metas mensais</span> e veja o
                                <span className="text-emerald-400 font-bold"> ranking de performance</span> do time.
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => navigate('/dashboard/configuracoes')}
                            className="mt-4 min-h-[56px] px-8 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-500/25 border-0 relative z-10"
                        >
                            Faça Upgrade para Enterprise
                        </Button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <HeaderDashboard title="Gestão de Equipe" subtitle={`${members.length} membro(s) no workspace.`} breadcrumb="Dashboard / Equipe" />
            <div className="p-6 sm:p-8 max-w-6xl mx-auto w-full space-y-6">

                {/* Workspace Overview */}
                {workspace && (
                    <div className="rounded-3xl bg-card border border-border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{workspace.name || 'Meu Workspace'}</h2>
                            <p className="text-xs text-muted mt-1">Plano: <span className="text-emerald-400 font-bold">{workspace.plan}</span> · Créditos: <span className="tabular-nums">{workspace.leadsUsed}/{workspace.leadsLimit}</span></p>
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            icon={<UserPlus size={16} />}
                            onClick={() => setShowInvite(!showInvite)}
                            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 shadow-lg shadow-emerald-500/25 border-0"
                        >
                            Convidar Membro
                        </Button>
                    </div>
                )}

                {/* Invite Form */}
                {showInvite && (
                    <form onSubmit={handleInvite} className="rounded-3xl bg-card border border-emerald-500/20 p-6 flex flex-col sm:flex-row gap-4">
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="Email do vendedor"
                            className="flex-1 h-12 bg-surface border border-border rounded-xl px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            required
                        />
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={inviting || !inviteEmail.trim()}
                            icon={inviting ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                            className="h-12 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 border-0"
                        >
                            {inviting ? 'Convidando...' : 'Enviar Convite'}
                        </Button>
                    </form>
                )}

                {/* Lista de convites pendentes: Convite enviado + Reenviar (40s) */}
                {pendingInvitations.length > 0 && (
                    <div className="rounded-3xl bg-card border border-amber-500/20 p-6 flex flex-col gap-3">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Convites enviados (aguardando aceite)</h3>
                        <ul className="space-y-2">
                            {pendingInvitations.map((p) => {
                                const cooldown = !canResend(p.lastSentAt);
                                const secondsLeft = cooldown
                                    ? Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(p.lastSentAt).getTime())) / 1000)
                                    : 0;
                                return (
                                    <li key={p.id} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                                        <span className="text-sm text-foreground">{p.email}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted">Convite enviado</span>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                disabled={cooldown || resendingId === p.id}
                                                onClick={() => handleResendInvite(p.id)}
                                                icon={resendingId === p.id ? <Loader2 size={14} className="animate-spin" /> : undefined}
                                                className="min-w-[100px]"
                                            >
                                                {resendingId === p.id ? 'Enviando...' : cooldown ? `Reenviar (${secondsLeft}s)` : 'Reenviar'}
                                            </Button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="text-xs text-muted">A pessoa só entra na equipe após aceitar o convite pelo link do email.</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center p-12 text-muted gap-3">
                        <Loader2 size={24} className="animate-spin" />
                        <span>Carregando equipe...</span>
                    </div>
                ) : (
                    <>
                        {isAdminOrOwner && (
                            <div className="flex gap-2 p-1 rounded-xl bg-surface border border-border w-fit">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('ranking')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'ranking' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-foreground'}`}
                                >
                                    <Trophy size={14} className="inline mr-2 align-middle" /> Ranking
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('dashboard')}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-foreground'}`}
                                >
                                    <LayoutDashboard size={14} className="inline mr-2 align-middle" /> Dashboard
                                </button>
                            </div>
                        )}

                        {viewMode === 'dashboard' && isAdminOrOwner ? (
                            <div className="space-y-6">
                                {loadingDashboard ? (
                                    <div className="flex items-center justify-center p-12 text-muted gap-3">
                                        <Loader2 size={24} className="animate-spin" />
                                        <span>Carregando dashboard...</span>
                                    </div>
                                ) : dashboardData ? (
                                    <>
                                        <div className="rounded-3xl bg-card border border-border p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider">Leads hoje</p>
                                                <p className="text-2xl font-bold text-foreground tabular-nums">{dashboardData.totals.todayLeads}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider">Análises hoje</p>
                                                <p className="text-2xl font-bold text-violet-400 tabular-nums">{dashboardData.totals.todayAnalyses}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider">Leads no mês</p>
                                                <p className="text-2xl font-bold text-foreground tabular-nums">{dashboardData.totals.monthLeads}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted uppercase tracking-wider">Abaixo da meta</p>
                                                <p className="text-2xl font-bold tabular-nums">{dashboardData.totals.belowGoalCount > 0 ? <span className="text-amber-400 flex items-center gap-1"><AlertCircle size={20} /> {dashboardData.totals.belowGoalCount}</span> : <span className="text-emerald-400">0</span>}</p>
                                            </div>
                                        </div>
                                        <div className="rounded-3xl bg-card border border-border overflow-hidden">
                                            <div className="p-5 border-b border-border">
                                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Meta vs Realizado</h3>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b border-border text-left">
                                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">Membro</th>
                                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase text-right">Hoje (L/A)</th>
                                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">Meta vs Dia</th>
                                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase">Conversões mês</th>
                                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase w-20">Alerta</th>
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
                                                                    <td className="py-3 px-5">
                                                                        {m.goals.monthlyConversionsGoal != null ? (
                                                                            <span className="tabular-nums">{m.month.actions} / {m.goals.monthlyConversionsGoal} ({m.progress.monthlyConvPct ?? 0}%)</span>
                                                                        ) : (
                                                                            <span className="text-muted">—</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3 px-5">
                                                                        {m.belowGoal ? <span className="text-amber-400 flex items-center gap-1"><AlertCircle size={14} /> Abaixo</span> : <span className="text-muted">—</span>}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-3xl bg-card border border-border p-8 text-center text-muted">Nenhum dado do dashboard.</div>
                                )}
                            </div>
                        ) : (
                        <>
                        {/* Team Members Table */}
                        <div className="rounded-3xl bg-card border border-border overflow-hidden">
                            <div className="p-5 border-b border-border">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Trophy size={16} className="text-amber-400" /> Ranking da Equipe
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-left">
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">#</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">Membro</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">Função</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Leads</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Análises IA</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Ações (30d)</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Meta leads/dia</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Meta análises/dia</th>
                                            <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider text-right">Meta conversões/mês</th>
                                            {isAdminOrOwner && <th className="py-3 px-5 text-[10px] font-bold text-muted uppercase tracking-wider">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...members]
                                            .sort((a, b) => b.leadsAnalyzed - a.leadsAnalyzed)
                                            .map((m, i) => (
                                                <tr key={m.id} className="border-b border-border/30 hover:bg-surface/50 transition-colors">
                                                    <td className="py-3 px-5">
                                                        <span className={`w-7 h-7 inline-flex items-center justify-center rounded-lg font-bold text-xs ${i < 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-surface text-muted'}`}>
                                                            {i + 1}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center font-semibold text-xs text-violet-400 shrink-0">
                                                                {m.name?.[0] || m.email?.[0] || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-foreground">{m.name || 'Sem nome'}</p>
                                                                <p className="text-[10px] text-muted">{m.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-5">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.role === 'OWNER' ? 'bg-violet-500/15 text-violet-400' : 'bg-surface text-muted'
                                                            }`}>
                                                            {m.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-5 text-right tabular-nums font-bold text-foreground">{m.leadsUsed}</td>
                                                    <td className="py-3 px-5 text-right tabular-nums font-bold text-violet-400">{m.leadsAnalyzed}</td>
                                                    <td className="py-3 px-5 text-right tabular-nums font-bold text-emerald-400">{m.actionsLast30d}</td>
                                                    <td className="py-3 px-5 text-right tabular-nums text-muted">{m.dailyLeadsGoal ?? '-'}</td>
                                                    <td className="py-3 px-5 text-right tabular-nums text-muted">{m.dailyAnalysesGoal ?? '-'}</td>
                                                    <td className="py-3 px-5 text-right tabular-nums text-muted">{m.monthlyConversionsGoal ?? '-'}</td>
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
                                                                    aria-label="Ações"
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
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">Metas — {goalsModalMember.name || goalsModalMember.email}</h3>
                            <p className="text-xs text-muted mb-3 sm:mb-4">Defina as metas diárias/mensais para este membro.</p>
                            <form onSubmit={handleSaveGoals} className="space-y-3 sm:space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">Meta leads/dia</label>
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
                                    <label className="block text-xs font-medium text-muted mb-1">Meta análises/dia</label>
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
                                    <label className="block text-xs font-medium text-muted mb-1">Meta conversões/mês</label>
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
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={savingGoals}
                                        icon={savingGoals ? <Loader2 size={16} className="animate-spin" /> : undefined}
                                        className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0"
                                    >
                                        {savingGoals ? 'Salvando...' : 'Salvar'}
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
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">Editar função — {editModalMember.name || editModalMember.email}</h3>
                            <p className="text-xs text-muted mb-3 sm:mb-4">Altere a função do membro na equipe.</p>
                            <form onSubmit={handleSaveRole} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted mb-1">Função</label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value as 'MEMBER' | 'ADMIN')}
                                        className="w-full min-w-0 h-10 sm:h-11 bg-surface border border-border rounded-xl px-3 text-sm text-foreground"
                                    >
                                        <option value="MEMBER">Membro</option>
                                        {members.some((x) => x.userId === user.id && x.role === 'OWNER') && <option value="ADMIN">Admin</option>}
                                    </select>
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                                    <Button type="button" variant="secondary" onClick={() => setEditModalMember(null)} disabled={savingRole} className="w-full sm:flex-1">Cancelar</Button>
                                    <Button type="submit" variant="primary" disabled={savingRole} icon={savingRole ? <Loader2 size={16} className="animate-spin" /> : undefined} className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 border-0">
                                        {savingRole ? 'Salvando...' : 'Salvar'}
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
                            <h3 className="text-base sm:text-lg font-bold text-foreground mb-1">Remover da equipe</h3>
                            <p className="text-sm text-muted mb-4">
                                Remover <strong className="text-foreground">{deleteConfirmMember.name || deleteConfirmMember.email}</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                                <Button type="button" variant="secondary" onClick={() => setDeleteConfirmMember(null)} disabled={removing} className="w-full sm:flex-1">Cancelar</Button>
                                <Button type="button" variant="primary" onClick={handleRemoveMember} disabled={removing} icon={removing ? <Loader2 size={16} className="animate-spin" /> : undefined} className="w-full sm:flex-1 bg-destructive hover:bg-destructive/90 border-0 text-destructive-foreground">
                                    {removing ? 'Removendo...' : 'Remover'}
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
                                <Target size={14} className="text-amber-500 shrink-0" /> Metas
                            </button>
                            {m.role !== 'OWNER' && (
                                <>
                                    <button
                                        type="button"
                                        className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-surface flex items-center gap-2"
                                        onClick={() => { setEditModalMember(m); setEditRole(m.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'); closeActionsMenu(); }}
                                    >
                                        <Pencil size={14} className="text-violet-400 shrink-0" /> Editar função
                                    </button>
                                    <button
                                        type="button"
                                        className="w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                                        onClick={() => { setDeleteConfirmMember(m); closeActionsMenu(); }}
                                    >
                                        <Trash2 size={14} className="shrink-0" /> Remover
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
