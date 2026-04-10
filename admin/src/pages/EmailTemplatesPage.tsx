import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emailMarketingApi, type EmailTemplateItem, type EmailTemplateCreateBody } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FileText, Plus, Pencil, Trash2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  PROMOTION: 'Promoção',
  WEEKLY_REPORT: 'Relatório Semanal',
  FEATURE_ANNOUNCEMENT: 'Nova Feature',
  REENGAGEMENT: 'Reengajamento',
  CUSTOM: 'Customizado',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

export function EmailTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state for quick create
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState<string>('PROMOTION');
  const [formSubject, setFormSubject] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const load = () => {
    setLoading(true);
    emailMarketingApi.templates
      .list({ type: filterType || undefined, status: filterStatus || undefined, limit: 50 })
      .then((res) => {
        setTemplates(res.items);
        setTotal(res.total);
      })
      .catch(() => setToast({ type: 'error', message: 'Erro ao carregar templates.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType, filterStatus]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir template "${name}"?`)) return;
    try {
      await emailMarketingApi.templates.delete(id);
      setToast({ type: 'success', message: 'Template excluído.' });
      load();
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao excluir.' });
    }
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formSlug.trim() || !formSubject.trim()) {
      setToast({ type: 'error', message: 'Preencha nome, slug e assunto.' });
      return;
    }
    setFormSaving(true);
    try {
      const body: EmailTemplateCreateBody = {
        name: formName.trim(),
        slug: formSlug.trim(),
        type: formType as EmailTemplateCreateBody['type'],
        subject: formSubject.trim(),
        body: { paragraphs: ['Edite este texto no editor de template.'] },
      };
      const res = await emailMarketingApi.templates.create(body);
      setToast({ type: 'success', message: 'Template criado!' });
      setShowModal(false);
      setFormName(''); setFormSlug(''); setFormSubject('');
      navigate(`/email-templates/${res.data.id}`);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao criar.' });
    } finally {
      setFormSaving(false);
    }
  };

  const autoSlug = (name: string) => {
    setFormName(name);
    setFormSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />
            Templates de Email
          </h1>
          <p className="text-sm text-gray-500 mt-1">{total} template{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Novo Template
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
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full sm:w-48">
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full sm:w-48">
          <option value="">Todos os status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="ACTIVE">Ativo</option>
          <option value="ARCHIVED">Arquivado</option>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum template encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assunto</th>
                <th className="text-left px-4 py-3">Campanhas</th>
                <th className="text-left px-4 py-3">Atualizado</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status] ?? ''}`}>
                      {t.status === 'DRAFT' ? 'Rascunho' : t.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{t._count?.campaigns ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.updatedAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => navigate(`/email-templates/${t.id}`)} className="p-1.5 rounded-lg hover:bg-violet-50 text-gray-400 hover:text-violet-600" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(t.id, t.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Novo Template</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <Input value={formName} onChange={(e) => autoSlug(e.target.value)} placeholder="Ex: Promoção Black Friday" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="ex: promo-black-friday" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <Select value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto do Email</label>
                <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="Ex: Oferta especial para você" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={formSaving}>
                {formSaving ? 'Criando...' : 'Criar Template'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
