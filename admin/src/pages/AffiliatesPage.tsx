import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, type AdminAffiliateListItem } from '@/lib/api';

const PAGE_SIZE = 20;

function affiliateSignupLink(code: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/api/affiliate/click?ref=${encodeURIComponent(code)}`;
}

export function AffiliatesPage() {
  const [data, setData] = useState<{ items: AdminAffiliateListItem[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [hasPendingFilter, setHasPendingFilter] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', document: '', notes: '' });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: { limit: number; offset: number; status?: string; hasPendingCommissions?: boolean } = {
      limit: PAGE_SIZE,
      offset,
    };
    if (statusFilter) params.status = statusFilter;
    if (hasPendingFilter) params.hasPendingCommissions = true;
    adminApi
      .affiliates(params)
      .then((res) => setData({ items: res.items, total: res.total }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [offset, statusFilter, hasPendingFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const copyLink = (code: string) => {
    const url = affiliateSignupLink(code);
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      await adminApi.createAffiliate({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        document: createForm.document.trim() || undefined,
        notes: createForm.notes.trim() || undefined,
      });
      setModalOpen(false);
      setCreateForm({ name: '', email: '', document: '', notes: '' });
      setToast({ type: 'success', message: 'Afiliado criado com sucesso.' });
      setTimeout(() => setToast(null), 5000);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar');
    } finally {
      setCreateSubmitting(false);
    }
  };

  if (loading && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Afiliados</h1>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Afiliados</h1>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">{error}</div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Afiliados</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 w-full sm:w-auto text-center"
        >
          Novo afiliado externo
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
          className="rounded border border-gray-300 bg-gray-100 text-gray-700 px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="PENDING">PENDING</option>
          <option value="APPROVED">APPROVED</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={hasPendingFilter}
            onChange={(e) => { setHasPendingFilter(e.target.checked); setOffset(0); }}
            className="rounded border-gray-300"
          />
          Com comissões pendentes
        </label>
      </div>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xl max-w-md w-full">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Novo afiliado externo</h2>
            {createError && <p className="text-red-600 text-sm mb-2">{createError}</p>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 mb-1">Nome</label>
                <input required value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">E-mail</label>
                <input required type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Documento (CPF/CNPJ, opcional)</label>
                <input value={createForm.document} onChange={(e) => setCreateForm((f) => ({ ...f, document: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">Notas (opcional)</label>
                <textarea value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-700" rows={2} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createSubmitting} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm disabled:opacity-50">Criar</button>
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome / Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Taxa %</th>
                <th className="px-4 py-3 font-medium">Referrals</th>
                <th className="px-4 py-3 font-medium">Cliques</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum afiliado encontrado.
                  </td>
                </tr>
              ) : items.map((a) => (
                <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-violet-700">{a.code}</td>
                  <td className="px-4 py-3 text-gray-700">{a.name ?? a.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={a.status === 'APPROVED' ? 'text-green-600' : a.status === 'SUSPENDED' ? 'text-red-600' : 'text-amber-600'}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.commissionRatePercent}%</td>
                  <td className="px-4 py-3 text-gray-600">{a.referralCount}</td>
                  <td className="px-4 py-3 text-gray-600">{a.clickCount ?? 0}</td>
                  <td className="px-4 py-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(a.code)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                    >
                      {copiedCode === a.code ? 'Copiado' : 'Copiar link'}
                    </button>
                    <Link to={a.id} className="text-violet-600 hover:text-violet-700 text-sm">Detalhes</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
          >
            Anterior
          </button>
          <span>Página {currentPage} de {totalPages}</span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
