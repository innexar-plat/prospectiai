import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, supportApi, type AdminUserDetail, type SupportUserDetail } from '@/lib/api';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

type UserDetail = AdminUserDetail | SupportUserDetail;

function isAdminDetail(u: UserDetail): u is AdminUserDetail {
  return 'leadsUsed' in u && 'workspaces' in u && Array.isArray((u as AdminUserDetail).workspaces)
    && (u as AdminUserDetail).workspaces[0]?.workspace != null;
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useOutletContext<AdminLayoutContext>();
  const isSupport = role === 'support';
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState<'email' | 'temp'>('email');
  const [tempPassword, setTempPassword] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const api = isSupport ? supportApi.user(id) : adminApi.user(id);
    api
      .then((u) => setUser(u))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id, isSupport]);

  if (!id) {
    return (
      <div className="text-zinc-400">ID não informado.</div>
    );
  }

  if (loading && !user) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
          ← Usuários
        </Link>
        <div className="h-64 rounded-xl bg-zinc-800/50 animate-pulse" />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
          ← Usuários
        </Link>
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const disabledAt = 'disabledAt' in user ? user.disabledAt : null;
  const refetch = () => {
    if (!id) return;
    (isSupport ? supportApi.user(id) : adminApi.user(id))
      .then((u) => setUser(u))
      .catch(() => {});
  };

  const handleActivate = () => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    supportApi
      .activate(id)
      .then(refetch)
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao ativar'))
      .finally(() => setActionLoading(false));
  };

  const handleDeactivate = (reason?: string) => {
    if (!id) return;
    setActionLoading(true);
    setActionError(null);
    setShowDeactivateModal(false);
    setDeactivateReason('');
    supportApi
      .deactivate(id, reason ? { reason } : undefined)
      .then(refetch)
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao desativar'))
      .finally(() => setActionLoading(false));
  };

  const resetPasswordApi = isSupport ? supportApi : adminApi;
  const handleResetPassword = () => {
    if (!id) return;
    const body =
      resetPasswordMode === 'email'
        ? { sendEmail: true }
        : { temporaryPassword: tempPassword };
    setActionLoading(true);
    setActionError(null);
    resetPasswordApi
      .resetPassword(id, body)
      .then((res) => {
        setShowResetPasswordModal(false);
        setTempPassword('');
        setToast({ type: 'success', message: res.message });
        setTimeout(() => setToast(null), 5000);
      })
      .catch((err) => setActionError(err instanceof Error ? err.message : 'Erro ao resetar senha'))
      .finally(() => setActionLoading(false));
  };

  const workspacesList = isSupport
    ? (user as SupportUserDetail).workspaces
    : (user as AdminUserDetail).workspaces.map((w) => w.workspace);

  return (
    <div>
      <Link to=".." className="text-sm text-violet-400 hover:text-violet-300 mb-4 inline-block">
        ← Usuários
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-white">
          {user.name ?? user.email ?? user.id}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => { setShowResetPasswordModal(true); setResetPasswordMode('email'); setTempPassword(''); setActionError(null); }}
            className="px-4 py-2 rounded-lg bg-zinc-700 text-white text-sm font-medium hover:bg-zinc-600 disabled:opacity-50"
          >
            Resetar senha
          </button>
          {disabledAt ? (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleActivate}
              className="px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
            >
              Ativar conta
            </button>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setShowDeactivateModal(true)}
              className="px-4 py-2 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50"
            >
              Desativar conta
            </button>
          )}
        </div>
      </div>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${toast.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
          {toast.message}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {actionError}
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-zinc-500">Email</p>
            <p className="text-white">{user.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Plano</p>
            <p className="text-white">{user.plan}</p>
          </div>
          {!isSupport && isAdminDetail(user) && (
            <>
              <div>
                <p className="text-zinc-500">Leads usados / limite</p>
                <p className="text-white">{user.leadsUsed} / {user.leadsLimit}</p>
              </div>
              <div>
                <p className="text-zinc-500">Onboarding</p>
                <p className="text-white">{user.onboardingCompletedAt ? 'Concluído' : 'Pendente'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Empresa</p>
                <p className="text-white">{user.companyName ?? '—'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-zinc-500">Status da conta</p>
            <p className="text-white">{disabledAt ? 'Desativada' : 'Ativa'}</p>
          </div>
          <div>
            <p className="text-zinc-500">Criado em</p>
            <p className="text-white">{new Date(user.createdAt).toLocaleString('pt-BR')}</p>
          </div>
        </div>
        {isSupport && (
          <div>
            <p className="text-zinc-500 text-sm mb-2">Perfil (negócio)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-zinc-500">Onboarding</p>
                <p className="text-white">{(user as SupportUserDetail).onboardingCompletedAt ? 'Concluído' : 'Pendente'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Empresa</p>
                <p className="text-white">{(user as SupportUserDetail).companyName ?? '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Produto/serviço</p>
                <p className="text-white">{(user as SupportUserDetail).productService ?? '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Público-alvo</p>
                <p className="text-white">{(user as SupportUserDetail).targetAudience ?? '—'}</p>
              </div>
              <div>
                <p className="text-zinc-500">Principal benefício</p>
                <p className="text-white">{(user as SupportUserDetail).mainBenefit ?? '—'}</p>
              </div>
            </div>
          </div>
        )}
        {workspacesList.length > 0 && (
          <div>
            <p className="text-zinc-500 text-sm mb-2">Workspaces</p>
            <ul className="space-y-1">
              {workspacesList.map((w) => (
                <li key={w.id}>
                  {isSupport ? (
                    <span className="text-zinc-300 text-sm">{w.name ?? w.id}</span>
                  ) : (
                    <Link
                      to={`../workspaces/${w.id}`}
                      className="text-violet-400 hover:text-violet-300 text-sm"
                    >
                      {w.name ?? w.id}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {showResetPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Resetar senha</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Enviar email com link de redefinição ou definir uma senha temporária (mín. 8 caracteres).
            </p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setResetPasswordMode('email')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${resetPasswordMode === 'email' ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
              >
                Enviar email com link
              </button>
              <button
                type="button"
                onClick={() => setResetPasswordMode('temp')}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${resetPasswordMode === 'temp' ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'}`}
              >
                Definir senha temporária
              </button>
            </div>
            {resetPasswordMode === 'temp' && (
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                placeholder="Senha temporária (mín. 8 caracteres)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 mb-4"
              />
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowResetPasswordModal(false); setTempPassword(''); setActionError(null); }}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={actionLoading || (resetPasswordMode === 'temp' && tempPassword.length < 8)}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeactivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">Desativar conta</h2>
            <p className="text-zinc-400 text-sm mb-4">
              O usuário não poderá fazer login até a conta ser reativada. Opcionalmente informe o motivo.
            </p>
            <textarea
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              placeholder="Motivo (opcional)"
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeactivateModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-200 text-sm font-medium hover:bg-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeactivate(deactivateReason.trim() || undefined)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
