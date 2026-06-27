import { useCallback, useEffect, useState } from 'react';
import { autoProspeccaoAdminApi, type AutoProspSearchProfile } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Search, Plus, Pencil, Trash2, CheckCircle2, XCircle, Star } from 'lucide-react';
import { useConfirm } from '@/lib/useConfirm';

const PORTE_LABELS: Record<string, string> = {
  ME: 'ME', EPP: 'EPP', EMP: 'Empresa', DEMAIS: 'Demais',
};

const EMPTY_FORM: Omit<AutoProspSearchProfile, 'id' | 'lastRunAt' | 'totalFound' | 'totalHot' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  isSystem: true,
  isActive: true,
  priority: 0,
  cnae: '',
  cnaeList: [],
  uf: [],
  porte: [],
  hasEmail: null,
  hasPhone: null,
  minCapital: null,
  workspaceId: null,
};

export function AutoProspeccaoSearchProfilesPage() {
  const [profiles, setProfiles] = useState<AutoProspSearchProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AutoProspSearchProfile | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    autoProspeccaoAdminApi.searchProfiles
      .list({ limit: 100 })
      .then((res) => { setProfiles(res.data); setTotal(res.meta.total); })
      .catch(() => showToast('error', 'Erro ao carregar perfis.'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (p: AutoProspSearchProfile) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      description: p.description ?? '',
      isSystem: p.isSystem,
      isActive: p.isActive,
      priority: p.priority,
      cnae: p.cnae ?? '',
      cnaeList: p.cnaeList ?? [],
      uf: p.uf ?? [],
      porte: p.porte ?? [],
      hasEmail: p.hasEmail,
      hasPhone: p.hasPhone,
      minCapital: p.minCapital,
      workspaceId: p.workspaceId,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return showToast('error', 'Nome é obrigatório.');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: (form.description as string).trim() || null,
        isSystem: form.isSystem,
        isActive: form.isActive,
        priority: form.priority,
        cnae: (form.cnae as string).trim() || null,
        cnaeList: (form.cnaeList as string[]).length ? form.cnaeList : null,
        uf: (form.uf as string[]).length ? form.uf : null,
        porte: (form.porte as string[]).length ? form.porte : null,
        hasEmail: form.hasEmail,
        hasPhone: form.hasPhone,
        minCapital: form.minCapital,
      };
      if (editTarget) {
        await autoProspeccaoAdminApi.searchProfiles.update(editTarget.id, payload);
        showToast('success', 'Perfil atualizado.');
      } else {
        await autoProspeccaoAdminApi.searchProfiles.create(payload);
        showToast('success', 'Perfil criado.');
      }
      setShowModal(false);
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: AutoProspSearchProfile) => {
    try {
      await autoProspeccaoAdminApi.searchProfiles.update(p.id, { isActive: !p.isActive });
      load();
    } catch {
      showToast('error', 'Erro ao alterar status.');
    }
  };

  const handleDelete = async (p: AutoProspSearchProfile) => {
    if (!(await confirm({ title: 'Excluir perfil', message: `Excluir "${p.name}"? Se houver histórico associado, será bloqueado.`, confirmLabel: 'Excluir' }))) return;
    try {
      await autoProspeccaoAdminApi.searchProfiles.delete(p.id);
      showToast('success', 'Perfil excluído.');
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao excluir.');
    }
  };

  const setField = (field: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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
            <Search className="w-5 h-5 text-violet-600" />
            Perfis de Busca — Auto-Prospecção
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} perfil{total !== 1 ? 'is' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Perfil
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Carregando...</div>
        ) : profiles.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nenhum perfil encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Filtros</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Prior.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Encontrados</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Sistema</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Ativo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs space-y-0.5">
                    {p.cnae && <div>CNAE: <span className="font-mono">{p.cnae}</span></div>}
                    {Array.isArray(p.cnaeList) && p.cnaeList.length > 0 && <div>CNAEs: {(p.cnaeList as string[]).join(', ')}</div>}
                    {Array.isArray(p.uf) && p.uf.length > 0 && <div>UF: {(p.uf as string[]).join(', ')}</div>}
                    {Array.isArray(p.porte) && p.porte.length > 0 && <div>Porte: {(p.porte as string[]).map(k => PORTE_LABELS[k] ?? k).join(', ')}</div>}
                    {!p.cnae && !(Array.isArray(p.cnaeList) && (p.cnaeList as string[]).length) && !(Array.isArray(p.uf) && (p.uf as string[]).length) && <span className="text-gray-300">Sem filtros</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.priority}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-700 font-medium">{p.totalFound}</span>
                    {p.totalHot > 0 && <span className="ml-1 text-xs text-red-600">({p.totalHot} HOT)</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.isSystem && <Star className="w-4 h-4 text-violet-500 inline" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleActive(p)} title={p.isActive ? 'Desativar' : 'Ativar'}>
                      {p.isActive
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <XCircle className="w-4 h-4 text-gray-300" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{editTarget ? 'Editar Perfil' : 'Novo Perfil'}</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.name as string} onChange={(e) => setField('name', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="ex: Consultorias SP" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input value={form.description as string} onChange={(e) => setField('description', e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Descrição opcional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNAE único</label>
                  <input value={form.cnae as string} onChange={(e) => setField('cnae', e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="ex: 7020400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lista de CNAEs</label>
                  <input
                    value={(form.cnaeList as string[]).join(',')}
                    onChange={(e) => setField('cnaeList', e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(Boolean) : [])}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="7020400,7311400 (separado por vírgula)" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UFs</label>
                  <input
                    value={(form.uf as string[]).join(',')}
                    onChange={(e) => setField('uf', e.target.value ? e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [])}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="SP,RJ,MG" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porte</label>
                  <input
                    value={(form.porte as string[]).join(',')}
                    onChange={(e) => setField('porte', e.target.value ? e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [])}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="ME,EPP,DEMAIS" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capital mínimo (R$)</label>
                  <input
                    type="number"
                    value={form.minCapital ?? ''}
                    onChange={(e) => setField('minCapital', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="ex: 100000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                  <input
                    type="number"
                    value={form.priority as number}
                    onChange={(e) => setField('priority', parseInt(e.target.value, 10) || 0)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isSystem as boolean} onChange={(e) => setField('isSystem', e.target.checked)} className="rounded accent-violet-600" />
                  <span className="text-sm font-medium text-gray-700">Template do sistema (global)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive as boolean} onChange={(e) => setField('isActive', e.target.checked)} className="rounded accent-violet-600" />
                  <span className="text-sm font-medium text-gray-700">Ativo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasEmail === true} onChange={(e) => setField('hasEmail', e.target.checked ? true : null)} className="rounded accent-violet-600" />
                  <span className="text-sm font-medium text-gray-700">Exigir email</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasPhone === true} onChange={(e) => setField('hasPhone', e.target.checked ? true : null)} className="rounded accent-violet-600" />
                  <span className="text-sm font-medium text-gray-700">Exigir telefone</span>
                </label>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
