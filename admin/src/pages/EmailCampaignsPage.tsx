import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  emailMarketingApi,
  type EmailCampaignItem,
  type EmailCampaignCreateBody,
  type EmailTemplateItem,
  type EmailCampaignAudience,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Send, Plus, Eye, Play, XCircle, Trash2, Users, Calendar, BarChart3, Pencil } from 'lucide-react';
import { useConfirm } from '@/lib/useConfirm';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  SCHEDULED: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  SENDING: { label: 'Enviando...', color: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviada', color: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: 'Todos os usuários',
  FREE: 'Plano Free',
  PAID: 'Planos pagos',
  TRIAL: 'Em trial',
  CHURNED: 'Churned',
  INACTIVE: 'Inativos',
  CUSTOM: 'Filtro customizado',
};

export function EmailCampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<EmailCampaignItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // Create form
  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formAudience, setFormAudience] = useState<EmailCampaignAudience>('ALL');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Edit form
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaignItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('');
  const [editAudience, setEditAudience] = useState<EmailCampaignAudience>('ALL');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    emailMarketingApi.campaigns
      .list({ status: filterStatus || undefined, limit: 50 })
      .then((res) => {
        setCampaigns(res.items);
        setTotal(res.total);
      })
      .catch(() => setToast({ type: 'error', message: 'Erro ao carregar campanhas.' }))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showModal && templates.length === 0) {
      emailMarketingApi.templates.list({ status: 'ACTIVE', limit: 100 }).then((res) => {
        setTemplates(res.items);
        if (res.items.length > 0 && !formTemplateId) setFormTemplateId(res.items[0].id);
      });
    }
  }, [showModal, templates.length, formTemplateId]);

  const fetchAudienceCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const { count } = await emailMarketingApi.audienceCount(formAudience);
      setAudienceCount(count);
    } catch {
      setAudienceCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [formAudience]);

  useEffect(() => {
    if (showModal) fetchAudienceCount();
  }, [showModal, fetchAudienceCount]);

  const handleCreate = async () => {
    if (!formName.trim() || !formTemplateId) {
      setToast({ type: 'error', message: 'Preencha nome e selecione um template.' });
      return;
    }
    setFormSaving(true);
    try {
      const body: EmailCampaignCreateBody = {
        name: formName.trim(),
        templateId: formTemplateId,
        audience: formAudience,
        scheduledAt: formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
      };
      await emailMarketingApi.campaigns.create(body);
      setToast({ type: 'success', message: 'Campanha criada!' });
      setShowModal(false);
      setFormName(''); setFormScheduledAt('');
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao criar.' });
    } finally {
      setFormSaving(false);
    }
  };

  const handleSend = async (id: string, name: string) => {
    if (!(await confirm({ title: 'Enviar campanha', message: `Enviar campanha "${name}" agora?`, confirmLabel: 'Enviar', variant: 'primary' }))) return;
    try {
      const res = await emailMarketingApi.campaigns.send(id);
      setToast({ type: 'success', message: `${res.message}. Enviados: ${res.totalSent ?? 0}` });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao enviar.' });
    }
  };

  const handleCancel = async (id: string) => {
    if (!(await confirm({ title: 'Cancelar campanha', message: 'Tem certeza que deseja cancelar esta campanha?', confirmLabel: 'Cancelar campanha' }))) return;
    try {
      await emailMarketingApi.campaigns.cancel(id);
      setToast({ type: 'success', message: 'Campanha cancelada.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm({ title: 'Excluir campanha', message: `Excluir campanha "${name}"? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir' }))) return;
    try {
      await emailMarketingApi.campaigns.delete(id);
      setToast({ type: 'success', message: 'Campanha excluída.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro.' });
    }
  };

  const openEdit = (c: EmailCampaignItem) => {
    setEditingCampaign(c);
    setEditName(c.name);
    setEditTemplateId(c.templateId);
    setEditAudience(c.audience as EmailCampaignAudience);
    if (c.scheduledAt) {
      const d = new Date(c.scheduledAt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      setEditScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    } else {
      setEditScheduledAt('');
    }
    // Load templates if not loaded yet
    if (templates.length === 0) {
      emailMarketingApi.templates.list({ status: 'ACTIVE', limit: 100 }).then((res) => setTemplates(res.items));
    }
  };

  const handleUpdate = async () => {
    if (!editingCampaign || !editName.trim() || !editTemplateId) return;
    setEditSaving(true);
    try {
      await emailMarketingApi.campaigns.update(editingCampaign.id, {
        name: editName.trim(),
        templateId: editTemplateId,
        audience: editAudience,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : null,
      });
      setToast({ type: 'success', message: 'Campanha atualizada!' });
      setEditingCampaign(null);
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao atualizar.' });
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Send className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
            Campanhas de Email
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} campanha{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nova Campanha
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-48">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Nenhuma campanha encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const st = STATUS_CONFIG[c.status] ?? { label: c.status, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="w-3.5 h-3.5" /> {c.template?.name ?? c.templateId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {AUDIENCE_LABELS[c.audience] ?? c.audience}
                      </span>
                      {c.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {new Date(c.scheduledAt).toLocaleString('pt-BR')}
                        </span>
                      )}
                      {c.status === 'SENT' && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          ✓ {c.totalSent} enviados {c.totalFailed > 0 && <span className="text-red-500">| {c.totalFailed} falhas</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <button onClick={() => handleSend(c.id, c.name)} className="p-2 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="Enviar agora">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {(c.status === 'SCHEDULED' || c.status === 'SENDING') && (
                      <button onClick={() => handleCancel(c.id)} className="p-2 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600" title="Cancelar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {c.status === 'SENT' && (
                      <button onClick={() => navigate(`${c.id}`)} className="p-2 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600" title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {c.status !== 'SENDING' && (
                      <button onClick={() => handleDelete(c.id, c.name)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Campanha</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Campanha</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Promoção Free Users Abril" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                {templates.length === 0 ? (
                  <p className="text-sm text-amber-600">Nenhum template ativo. Crie e ative um template primeiro.</p>
                ) : (
                  <Select value={formTemplateId} onChange={(e) => setFormTemplateId(e.target.value)}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
                  </Select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audiência</label>
                <Select value={formAudience} onChange={(e) => setFormAudience(e.target.value as EmailCampaignAudience)}>
                  {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
                {audienceCount !== null && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {loadingCount ? 'Contando...' : `${audienceCount.toLocaleString('pt-BR')} destinatários estimados`}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agendar envio <span className="text-gray-400 font-normal">(opcional — vazio = envio imediato)</span>
                </label>
                <Input type="datetime-local" value={formScheduledAt} onChange={(e) => setFormScheduledAt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={formSaving || templates.length === 0}>
                {formSaving ? 'Criando...' : 'Criar Campanha'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Editar Campanha</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Campanha</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-400">Carregando templates...</p>
                ) : (
                  <Select value={editTemplateId} onChange={(e) => setEditTemplateId(e.target.value)}>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>)}
                  </Select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audiência</label>
                <Select value={editAudience} onChange={(e) => setEditAudience(e.target.value as EmailCampaignAudience)}>
                  {Object.entries(AUDIENCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agendar envio</label>
                <Input type="datetime-local" value={editScheduledAt} onChange={(e) => setEditScheduledAt(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setEditingCampaign(null)}>Cancelar</Button>
              <Button onClick={handleUpdate} disabled={editSaving}>
                {editSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialog}
    </div>
  );
}
