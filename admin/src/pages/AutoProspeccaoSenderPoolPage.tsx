import { useEffect, useState } from 'react';
import {
  autoProspeccaoAdminApi,
  adminApi,
  type SenderPoolItem,
  type AdminWorkspaceListItem,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Mail, Plus, Search, Trash2, Settings, CheckCircle2, XCircle, Send } from 'lucide-react';

type ProviderType = 'resend' | 'smtp';

interface SenderForm {
  label: string;
  provider: ProviderType;
  fromEmail: string;
  isActive: boolean;
  dailyLimit: number;
  // Resend
  resendApiKey: string;
  // SMTP
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
}

const EMPTY_FORM: SenderForm = {
  label: '',
  provider: 'resend',
  fromEmail: '',
  isActive: true,
  dailyLimit: 200,
  resendApiKey: '',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPassword: '',
};

export function AutoProspeccaoSenderPoolPage() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceListItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [senders, setSenders] = useState<SenderPoolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SenderForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Test email state (per sender)
  const [testEmailOpen, setTestEmailOpen] = useState<string | null>(null);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testing, setTesting] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    adminApi
      .workspaces({ limit: 100 })
      .then((res) => setWorkspaces(res.items))
      .catch(() => showToast('error', 'Erro ao carregar workspaces.'));
  }, []);

  const loadSenders = (wsId: string) => {
    if (!wsId) return;
    setLoading(true);
    setSenders([]);
    autoProspeccaoAdminApi.senderPool
      .list(wsId)
      .then((res) => setSenders(res.data))
      .catch((err) =>
        showToast('error', err instanceof Error ? err.message : 'Erro ao carregar remetentes.'),
      )
      .finally(() => setLoading(false));
  };

  const handleWorkspaceChange = (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    loadSenders(wsId);
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEdit = (sender: SenderPoolItem) => {
    setEditId(sender.id);
    setForm({
      label: sender.label,
      provider: sender.provider as ProviderType,
      fromEmail: sender.fromEmail,
      isActive: sender.isActive,
      dailyLimit: sender.dailyLimit,
      resendApiKey: '',
      smtpHost: sender.smtpHost ?? '',
      smtpPort: String(sender.smtpPort ?? 587),
      smtpUser: sender.smtpUser ?? '',
      smtpPassword: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedWorkspaceId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        label: form.label.trim(),
        provider: form.provider,
        fromEmail: form.fromEmail.trim(),
        isActive: form.isActive,
        dailyLimit: Number(form.dailyLimit),
      };
      if (form.provider === 'resend') {
        if (form.resendApiKey.trim()) payload.resendApiKey = form.resendApiKey.trim();
      } else {
        payload.smtpHost = form.smtpHost.trim();
        payload.smtpPort = Number(form.smtpPort);
        payload.smtpUser = form.smtpUser.trim();
        if (form.smtpPassword.trim()) payload.smtpPassword = form.smtpPassword.trim();
      }

      if (editId) {
        const res = await autoProspeccaoAdminApi.senderPool.update(editId, payload);
        setSenders((prev) => prev.map((s) => (s.id === editId ? res.data : s)));
        showToast('success', 'Remetente atualizado com sucesso.');
      } else {
        payload.workspaceId = selectedWorkspaceId;
        const res = await autoProspeccaoAdminApi.senderPool.create(payload);
        setSenders((prev) => [...prev, res.data]);
        showToast('success', 'Remetente adicionado com sucesso.');
      }
      setModalOpen(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar remetente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (sender: SenderPoolItem) => {
    try {
      const res = await autoProspeccaoAdminApi.senderPool.update(sender.id, {
        isActive: !sender.isActive,
      });
      setSenders((prev) => prev.map((s) => (s.id === sender.id ? res.data : s)));
    } catch {
      showToast('error', 'Erro ao alterar status do remetente.');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await autoProspeccaoAdminApi.senderPool.delete(deleteId);
      setSenders((prev) => prev.filter((s) => s.id !== deleteId));
      showToast('success', 'Remetente removido.');
      setDeleteId(null);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao remover remetente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestEmail = async (senderId: string) => {
    if (!testEmailAddress.trim()) {
      showToast('error', 'Informe um e-mail de destino.');
      return;
    }
    setTesting(true);
    try {
      await autoProspeccaoAdminApi.senderPool.test(senderId, testEmailAddress.trim());
      showToast('success', `E-mail de teste enviado para ${testEmailAddress}.`);
      setTestEmailOpen(null);
      setTestEmailAddress('');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao enviar e-mail de teste.');
    } finally {
      setTesting(false);
    }
  };

  const setField = <K extends keyof SenderForm>(key: K, value: SenderForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pool de Remetentes</h1>
            <p className="text-sm text-gray-500">
              Configure vários remetentes por workspace. O sistema distribui os envios em
              round-robin respeitando o limite diário de cada remetente.
            </p>
          </div>
        </div>
        {selectedWorkspaceId && (
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Remetente
          </Button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Workspace Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <select
          className="flex-1 border-0 outline-none text-sm text-gray-800 bg-transparent"
          value={selectedWorkspaceId}
          onChange={(e) => handleWorkspaceChange(e.target.value)}
        >
          <option value="">Selecione um workspace...</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.id.slice(0, 8)})
            </option>
          ))}
        </select>
      </div>

      {/* Senders list */}
      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Carregando remetentes...</div>
      )}

      {!loading && selectedWorkspaceId && senders.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Mail className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Nenhum remetente configurado para este workspace.</p>
          <p className="text-gray-400 text-xs mt-1">
            Clique em "Adicionar Remetente" para começar.
          </p>
        </div>
      )}

      {!loading && senders.length > 0 && (
        <div className="space-y-3">
          {senders.map((sender) => {
            const pct = Math.min(100, Math.round((sender.sentToday / sender.dailyLimit) * 100));
            return (
              <div
                key={sender.id}
                className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{sender.label}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sender.provider === 'resend'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {sender.provider === 'resend' ? 'Resend' : 'SMTP'}
                    </span>
                    {sender.isActive ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <XCircle className="w-3 h-3" /> Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{sender.fromEmail}</p>
                  {/* Daily limit bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-xs">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          pct >= 90
                            ? 'bg-red-400'
                            : pct >= 70
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {sender.sentToday}/{sender.dailyLimit} hoje
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Test email */}
                  {testEmailOpen === sender.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="email@destino.com"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-44"
                        onKeyDown={(e) => e.key === 'Enter' && handleTestEmail(sender.id)}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleTestEmail(sender.id)}
                        disabled={testing}
                      >
                        {testing ? '...' : 'Enviar'}
                      </Button>
                      <button
                        className="text-gray-400 hover:text-gray-600 text-xs"
                        onClick={() => {
                          setTestEmailOpen(null);
                          setTestEmailAddress('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      title="Testar remetente"
                      className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                      onClick={() => {
                        setTestEmailOpen(sender.id);
                        setTestEmailAddress('');
                      }}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}

                  {/* Toggle active */}
                  <button
                    title={sender.isActive ? 'Desativar' : 'Ativar'}
                    className="p-2 rounded hover:bg-gray-100 transition-colors"
                    onClick={() => handleToggleActive(sender)}
                  >
                    {sender.isActive ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    title="Editar"
                    className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    onClick={() => openEdit(sender)}
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    title="Remover"
                    className="p-2 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
                    onClick={() => setDeleteId(sender.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {editId ? 'Editar Remetente' : 'Adicionar Remetente'}
              </h2>

              <div className="space-y-4">
                {/* Label */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Rótulo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Domínio Principal, Backup Gmail"
                    value={form.label}
                    onChange={(e) => setField('label', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Provider */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Provedor <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {(['resend', 'smtp'] as ProviderType[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setField('provider', p)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.provider === p
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {p === 'resend' ? 'Resend' : 'SMTP'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* From Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    E-mail remetente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder='Ex: "Precision IA" <contato@precisionia.com.br>'
                    value={form.fromEmail}
                    onChange={(e) => setField('fromEmail', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Daily limit */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Limite diário de envios
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={form.dailyLimit}
                    onChange={(e) => setField('dailyLimit', Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {/* Resend credentials */}
                {form.provider === 'resend' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Resend API Key{' '}
                      {!editId && <span className="text-red-500">*</span>}
                      {editId && (
                        <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder="re_..."
                      value={form.resendApiKey}
                      onChange={(e) => setField('resendApiKey', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                )}

                {/* SMTP credentials */}
                {form.provider === 'smtp' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Host <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="smtp.gmail.com"
                          value={form.smtpHost}
                          onChange={(e) => setField('smtpHost', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Porta <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          placeholder="587"
                          value={form.smtpPort}
                          onChange={(e) => setField('smtpPort', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Usuário <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="usuario@dominio.com"
                        value={form.smtpUser}
                        onChange={(e) => setField('smtpUser', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Senha{' '}
                        {!editId && <span className="text-red-500">*</span>}
                        {editId && (
                          <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>
                        )}
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={form.smtpPassword}
                        onChange={(e) => setField('smtpPassword', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Active toggle */}
                <div className="flex items-center gap-3 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={form.isActive}
                      onChange={(e) => setField('isActive', e.target.checked)}
                    />
                    <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                  <span className="text-sm text-gray-700">Remetente ativo</span>
                </div>
              </div>

              {/* Modal actions */}
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Remover remetente?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Esta ação não pode ser desfeita. O remetente será removido permanentemente do pool.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {deleting ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
