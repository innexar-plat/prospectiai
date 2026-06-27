import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { autoProspeccaoAdminApi, type AutoProspTemplate } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Mail, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useConfirm } from '@/lib/useConfirm';

const TYPE_LABELS: Record<string, string> = {
  HOT_COLD_INTRO: 'HOT — Intro',
  HOT_FOLLOW_NO_OPEN: 'HOT — Follow (não abriu)',
  HOT_FOLLOW_OPENED: 'HOT — Follow (abriu)',
  HOT_LAST_ATTEMPT: 'HOT — Última tentativa',
  WARM_WEEK1_EDUCATION: 'WARM — S1 Educação',
  WARM_WEEK2_VALUE: 'WARM — S2 Valor',
  WARM_WEEK3_SOCIAL: 'WARM — S3 Social',
  WARM_WEEK4_OFFER: 'WARM — S4 Oferta',
  CUSTOM: 'Personalizado',
};

const TYPE_COLORS: Record<string, string> = {
  HOT_COLD_INTRO: 'bg-red-100 text-red-700',
  HOT_FOLLOW_NO_OPEN: 'bg-red-100 text-red-700',
  HOT_FOLLOW_OPENED: 'bg-red-100 text-red-700',
  HOT_LAST_ATTEMPT: 'bg-red-100 text-red-700',
  WARM_WEEK1_EDUCATION: 'bg-amber-100 text-amber-700',
  WARM_WEEK2_VALUE: 'bg-amber-100 text-amber-700',
  WARM_WEEK3_SOCIAL: 'bg-amber-100 text-amber-700',
  WARM_WEEK4_OFFER: 'bg-amber-100 text-amber-700',
  CUSTOM: 'bg-gray-100 text-gray-700',
};

export function AutoProspeccaoTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AutoProspTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterSystem, setFilterSystem] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    autoProspeccaoAdminApi.templates
      .list({ isSystem: filterSystem || undefined, limit: 100 })
      .then((res) => { setTemplates(res.data); setTotal(res.meta.total); })
      .catch(() => showToast('error', 'Erro ao carregar templates.'))
      .finally(() => setLoading(false));
  }, [filterSystem, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm({ title: 'Excluir template', message: `Excluir "${name}"? Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir' }))) return;
    try {
      await autoProspeccaoAdminApi.templates.delete(id);
      showToast('success', 'Template excluído.');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  return (
    <div className="space-y-6">
      {ConfirmDialog}

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-violet-600" />
            Templates de Email — Auto-Prospecção
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} template{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('new')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={filterSystem}
          onChange={(e) => setFilterSystem(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todos (sistema + workspace)</option>
          <option value="true">Apenas sistema</option>
          <option value="false">Apenas workspace</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum template encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Assunto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Segmento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Sistema</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{t.name}</span>
                    {t.workspaceId && <span className="ml-2 text-xs text-gray-400">{t.workspaceId}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.subject}</td>
                  <td className="px-4 py-3 text-gray-500">{t.targetSegment ?? t.targetCnae ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-center">
                    {t.isSystem && <Star className="w-4 h-4 text-violet-500 inline" />}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => navigate(`${t.id}`)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
