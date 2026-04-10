import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { emailMarketingApi, type EmailCampaignItem, type EmailCampaignRecipientItem } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Play, XCircle, Users, Send, CheckCircle2, AlertCircle, Clock, Mail } from 'lucide-react';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  SCHEDULED: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Enviando...', color: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviada', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

const RECIPIENT_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-gray-100 text-gray-600' },
  SENT: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'Falha', color: 'bg-red-100 text-red-700' },
  SKIPPED: { label: 'Ignorado', color: 'bg-amber-100 text-amber-700' },
};

export function EmailCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<EmailCampaignItem | null>(null);
  const [recipients, setRecipients] = useState<EmailCampaignRecipientItem[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cRes, r] = await Promise.all([
        emailMarketingApi.campaigns.get(id),
        emailMarketingApi.campaigns.recipients(id, { offset: (recipientPage - 1) * 50, limit: 50 }),
      ]);
      setCampaign(cRes.data);
      setRecipients(r.items);
      setRecipientTotal(r.total);
    } catch {
      setToast({ type: 'error', message: 'Erro ao carregar campanha.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id, recipientPage]);

  const handleSend = async () => {
    if (!campaign || !confirm(`Enviar campanha "${campaign.name}" agora?`)) return;
    try {
      const res = await emailMarketingApi.campaigns.send(campaign.id);
      setToast({ type: 'success', message: `${res.message}. Enviados: ${res.totalSent ?? 0}` });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao enviar.' });
    }
  };

  const handleCancel = async () => {
    if (!campaign || !confirm('Cancelar campanha?')) return;
    try {
      await emailMarketingApi.campaigns.cancel(campaign.id);
      setToast({ type: 'success', message: 'Campanha cancelada.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro.' });
    }
  };

  if (loading && !campaign) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-64" />
        <div className="h-32 bg-gray-100 rounded-xl" />
        <div className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p>Campanha não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate('/email-campaigns')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const st = STATUS_BADGE[campaign.status] ?? { label: campaign.status, color: 'bg-gray-100 text-gray-700' };
  const totalPages = Math.ceil(recipientTotal / 50);
  const sentCount = recipients.filter(r => r.status === 'SENT').length;
  const failedCount = recipients.filter(r => r.status === 'FAILED').length;
  const skippedCount = recipients.filter(r => r.status === 'SKIPPED').length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => navigate('/email-campaigns')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{campaign.name}</h1>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st.color}`}>{st.label}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              Template: {campaign.template?.name ?? campaign.templateId}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
            <Button onClick={handleSend} className="flex items-center gap-2">
              <Play className="w-4 h-4" /> Enviar Agora
            </Button>
          )}
          {(campaign.status === 'SCHEDULED' || campaign.status === 'SENDING') && (
            <Button variant="ghost" onClick={handleCancel} className="flex items-center gap-2 text-red-600">
              <XCircle className="w-4 h-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users className="w-5 h-5 text-violet-600" />} label="Total destinatários" value={campaign.totalSent + campaign.totalFailed} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} label="Enviados" value={campaign.totalSent} />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-red-500" />} label="Falhas" value={campaign.totalFailed} />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          label={campaign.scheduledAt ? 'Agendado para' : 'Envio imediato'}
          value={campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString('pt-BR') : '—'}
          isText
        />
      </div>

      {/* Campaign Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400" /> Informações
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Audiência:</span>
            <span className="ml-2 text-gray-900">{campaign.audience}</span>
          </div>
          <div>
            <span className="text-gray-500">Criada em:</span>
            <span className="ml-2 text-gray-900">{new Date(campaign.createdAt).toLocaleString('pt-BR')}</span>
          </div>
          {campaign.sentAt && (
            <div>
              <span className="text-gray-500">Enviada em:</span>
              <span className="ml-2 text-gray-900">{new Date(campaign.sentAt).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4 text-gray-400" />
            Destinatários ({recipientTotal})
          </h2>
          <div className="flex gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{sentCount} enviados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{failedCount} falhas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{skippedCount} ignorados</span>
          </div>
        </div>
        {recipients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum destinatário registrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Usuário</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Enviado em</th>
                  <th className="px-4 py-2 font-medium">Erro</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map(r => {
                  const rb = RECIPIENT_BADGE[r.status] ?? { label: r.status, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-900">{r.userId}</td>
                      <td className="px-4 py-2 text-gray-600">{r.email}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rb.color}`}>{rb.label}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{r.sentAt ? new Date(r.sentAt).toLocaleString('pt-BR') : '—'}</td>
                      <td className="px-4 py-2 text-red-500 text-xs max-w-[200px] truncate">{r.error ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>Página {recipientPage} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={recipientPage <= 1} onClick={() => setRecipientPage(p => p - 1)}>Anterior</Button>
              <Button variant="ghost" size="sm" disabled={recipientPage >= totalPages} onClick={() => setRecipientPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, isText }: { icon: React.ReactNode; label: string; value: number | string; isText?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <span className={`${isText ? 'text-sm text-gray-700' : 'text-2xl font-bold text-gray-900'}`}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </span>
    </div>
  );
}
