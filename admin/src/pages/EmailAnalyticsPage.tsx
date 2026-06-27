import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emailMarketingApi, type EmailMarketingStats, type EmailCampaignItem } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { BarChart3, Send, FileText, AlertCircle, CheckCircle2, ArrowRight, TrendingUp } from 'lucide-react';

export function EmailAnalyticsPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmailMarketingStats | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<EmailCampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      emailMarketingApi.stats(),
      emailMarketingApi.campaigns.list({ limit: 5 }),
    ])
      .then(([s, c]) => {
        setStats(s);
        setRecentCampaigns(c.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar analytics.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Email Analytics</h1>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">{error}</div>
      </div>
    );
  }

  const successRate = stats && stats.totalSent > 0
    ? ((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100).toFixed(1)
    : '0';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
          Email Analytics
        </h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do sistema de email marketing</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<FileText className="w-5 h-5 text-violet-600" />}
          label="Templates"
          value={stats?.totalTemplates ?? 0}
          onClick={() => navigate('../email-templates')}
        />
        <StatCard
          icon={<Send className="w-5 h-5 text-blue-600" />}
          label="Campanhas"
          value={stats?.totalCampaigns ?? 0}
          onClick={() => navigate('../email-campaigns')}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          label="Emails enviados"
          value={stats?.totalSent ?? 0}
          subtitle={`${successRate}% taxa de sucesso`}
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          label="Falhas"
          value={stats?.totalFailed ?? 0}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Templates ativos</div>
          <div className="text-xl font-bold text-gray-900">{stats?.activeTemplates ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Campanhas recentes</div>
          <div className="text-xl font-bold text-gray-900">{stats?.recentCampaigns ?? 0}</div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" /> Campanhas Recentes
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('../email-campaigns')} className="flex items-center gap-1 text-violet-600">
            Ver todas <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Send className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma campanha ainda.</p>
            <Button variant="ghost" onClick={() => navigate('../email-campaigns')} className="mt-2 text-violet-600">Criar primeira campanha</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentCampaigns.map(c => {
              const statusColor =
                c.status === 'SENT' ? 'text-emerald-600' :
                c.status === 'SENDING' ? 'text-amber-600' :
                c.status === 'SCHEDULED' ? 'text-blue-600' :
                c.status === 'CANCELLED' ? 'text-red-500' : 'text-gray-500';
              return (
                <div
                  key={c.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => c.status === 'SENT' ? navigate(`../email-campaigns/${c.id}`) : navigate('../email-campaigns')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-medium text-gray-900 text-sm truncate">{c.name}</span>
                      <span className={`text-xs font-medium ${statusColor}`}>{c.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {c.template?.name ?? ''} · {c.audience}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {c.status === 'SENT' && (
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-600">{c.totalSent} ✓</span>
                        {c.totalFailed > 0 && <span className="text-red-500">{c.totalFailed} ✗</span>}
                      </div>
                    )}
                    <div className="mt-0.5">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          title="Criar Template"
          description="Crie um novo template para suas campanhas"
          onClick={() => navigate('../email-templates')}
          icon={<FileText className="w-5 h-5 text-violet-600" />}
        />
        <QuickAction
          title="Nova Campanha"
          description="Envie uma campanha de email marketing"
          onClick={() => navigate('../email-campaigns')}
          icon={<Send className="w-5 h-5 text-blue-600" />}
        />
        <QuickAction
          title="Relatório Semanal"
          description="Configure o envio automático de relatórios"
          onClick={() => navigate('../email-weekly-report')}
          icon={<BarChart3 className="w-5 h-5 text-emerald-600" />}
        />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subtitle, onClick }: {
  icon: React.ReactNode; label: string; value: number; subtitle?: string; onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-4 ${onClick ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('pt-BR')}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function QuickAction({ title, description, onClick, icon }: {
  title: string; description: string; onClick: () => void; icon: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="font-semibold text-gray-900 text-sm">{title}</span></div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}
