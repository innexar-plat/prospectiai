import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import type { SessionUser, RepDashboardDTO } from '@/lib/api';
import { representativeApi } from '@/lib/api/representative';
import { Copy, Wallet, Clock, Users, Target, Loader2, CheckCircle, BarChart3, Link2, MousePointerClick, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RepOverview() {
  useOutletContext<{ user: SessionUser }>();
  const [data, setData] = useState<RepDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    representativeApi.getDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const repLink = data?.disclosureLink ?? '';

  const copyLink = () => {
    if (!repLink) return;
    navigator.clipboard.writeText(repLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Visão Geral do Representante" />
        <div className="flex items-center justify-center flex-1 gap-2 text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <HeaderDashboard title="Visão Geral do Representante" />
        <div className="p-6 text-muted">Você ainda não possui um perfil de representante.</div>
      </div>
    );
  }

  const { dashboard, balance, recentCommissions, currency } = data;
  const goalProgress = dashboard.goalProgress;
  const goalPct = goalProgress?.percent ?? 0;
  const symbol = currency === 'USD' ? '$' : 'R$';
  const formatMoney = (cents: number) => `${symbol} ${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <HeaderDashboard title="Visão Geral" breadcrumb="Representante" />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <Wallet className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{formatMoney(balance.availableCents)}</p>
            <p className="text-xs text-muted">Saldo Disponível</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <Clock className="w-5 h-5 text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{formatMoney(dashboard.pendingCents)}</p>
            <p className="text-xs text-muted">Comissões Pendentes</p>
          </div>
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <MousePointerClick className="w-5 h-5 text-sky-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{dashboard.linkClicks}</p>
            <p className="text-xs text-muted">Cliques no Link</p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
            <UserPlus className="w-5 h-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{dashboard.leadsCount}</p>
            <p className="text-xs text-muted">Leads (sem plano pago)</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <Users className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{dashboard.activeClientsCount}</p>
            <p className="text-xs text-muted">Clientes Ativos</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <Target className="w-5 h-5 text-violet-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{goalPct}%</p>
            <p className="text-xs text-muted">Progresso da Meta</p>
          </div>
        </div>

        {goalProgress && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-violet-500" />
                <h3 className="font-bold text-foreground">Meta do Mês</h3>
              </div>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {formatMoney(goalProgress.achievedCents)} / {formatMoney(goalProgress.targetCents)}
              </span>
            </div>
            <div className="h-3 w-full bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-1000"
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-2">{goalPct}% da meta atingida</p>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-foreground">Últimas Comissões</h3>
          </div>
          {recentCommissions.length === 0 ? (
            <div className="p-4 text-sm text-muted">Nenhuma comissão registrada.</div>
          ) : (
            <div className="divide-y divide-border">
              {recentCommissions.slice(0, 5).map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{c.clientName || 'Cliente'}</p>
                    <p className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-foreground">{formatMoney(c.amountCents)}</p>
                    <span className={cn(
                      'inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      c.status === 'PAID' && 'bg-blue-500/10 text-blue-600',
                      c.status === 'APPROVED' && 'bg-emerald-500/10 text-emerald-600',
                      c.status === 'PENDING' && 'bg-amber-500/10 text-amber-600',
                      c.status === 'CANCELLED' && 'bg-gray-500/10 text-gray-500',
                    )}>
                      {c.status === 'PAID' ? 'Pago' : c.status === 'APPROVED' ? 'Aprovado' : c.status === 'PENDING' ? 'Pendente' : 'Cancelado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-5 h-5 text-violet-500" />
            <h3 className="font-bold text-foreground">Seu Link de Divulgação</h3>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-surface px-3 py-2 rounded-lg border border-border truncate">{repLink}</code>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors shrink-0"
            >
              {linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {linkCopied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
