import { useParams, Link, useOutletContext } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { adminApi, supportApi, type AdminUserDetail, type SupportUserDetail } from '@/lib/api';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

type UserDetail = AdminUserDetail | SupportUserDetail;

function isAdminDetail(u: UserDetail): u is AdminUserDetail {
  return 'leadsUsed' in u && 'workspaces' in u && Array.isArray((u as AdminUserDetail).workspaces)
    && (u as AdminUserDetail).workspaces[0]?.workspace != null;
}

function UserActionButtons({
  actionLoading,
  disabledAt,
  onActivate,
  onDeactivate,
  onResetPassword,
}: {
  actionLoading: boolean;
  disabledAt: string | null;
  onActivate: () => void;
  onDeactivate: () => void;
  onResetPassword: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={actionLoading} onClick={onResetPassword} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-900 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
        Resetar senha
      </button>
      {disabledAt ? (
        <button type="button" disabled={actionLoading} onClick={onActivate} className="px-4 py-2 rounded-lg bg-emerald-600/80 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50">
          Ativar conta
        </button>
      ) : (
        <button type="button" disabled={actionLoading} onClick={onDeactivate} className="px-4 py-2 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
          Desativar conta
        </button>
      )}
    </div>
  );
}

function ResetPasswordModal({
  open,
  mode,
  tempPassword,
  actionLoading,
  onClose,
  onModeChange,
  onTempPasswordChange,
  onConfirm,
}: {
  open: boolean;
  mode: 'email' | 'temp';
  tempPassword: string;
  actionLoading: boolean;
  onClose: () => void;
  onModeChange: (m: 'email' | 'temp') => void;
  onTempPasswordChange: (v: string) => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xl max-w-md w-full shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Resetar senha</h2>
        <p className="text-gray-500 text-sm mb-4">
          Enviar email com link de redefinição ou definir uma senha temporária (mín. 8 caracteres).
        </p>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => onModeChange('email')} className={`px-3 py-2 rounded-lg text-sm font-medium ${mode === 'email' ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-200'}`}>
            Enviar email com link
          </button>
          <button type="button" onClick={() => onModeChange('temp')} className={`px-3 py-2 rounded-lg text-sm font-medium ${mode === 'temp' ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-200'}`}>
            Definir senha temporária
          </button>
        </div>
        {mode === 'temp' && (
          <input type="text" value={tempPassword} onChange={(e) => onTempPasswordChange(e.target.value)} placeholder="Senha temporária (mín. 8 caracteres)" className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 mb-4" />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={actionLoading || (mode === 'temp' && tempPassword.length < 8)} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-50">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function DeactivateModal({
  open,
  reason,
  actionLoading,
  onClose,
  onReasonChange,
  onConfirm,
}: {
  open: boolean;
  reason: string;
  actionLoading: boolean;
  onClose: () => void;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xl max-w-md w-full shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Desativar conta</h2>
        <p className="text-gray-500 text-sm mb-4">O usuário não poderá fazer login até a conta ser reativada. Opcionalmente informe o motivo.</p>
        <textarea value={reason} onChange={(e) => onReasonChange(e.target.value)} placeholder="Motivo (opcional)" rows={3} className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 mb-4" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-200">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={actionLoading} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50">Desativar</button>
        </div>
      </div>
    </div>
  );
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
      <div className="text-gray-500">ID não informado.</div>
    );
  }

  if (loading && !user) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
          ← Usuários
        </Link>
        <div className="h-64 rounded-xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div>
        <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
          ← Usuários
        </Link>
        <div className="rounded-lg bg-red-50 border border-red-300 text-red-600 px-4 py-3">
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
      .then(() => {
        refetch();
        setToast({ type: 'success', message: 'Conta ativada com sucesso.' });
        setTimeout(() => setToast(null), 5000);
      })
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
      .then(() => {
        refetch();
        setToast({ type: 'success', message: 'Conta desativada com sucesso.' });
        setTimeout(() => setToast(null), 5000);
      })
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
      <Link to=".." className="text-sm text-violet-600 hover:text-violet-700 mb-4 inline-block">
        ← Usuários
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {user.name ?? user.email ?? user.id}
        </h1>
        <UserActionButtons
          actionLoading={actionLoading}
          disabledAt={disabledAt}
          onActivate={handleActivate}
          onDeactivate={() => setShowDeactivateModal(true)}
          onResetPassword={() => { setShowResetPasswordModal(true); setResetPasswordMode('email'); setTempPassword(''); setActionError(null); }}
        />
      </div>
      {toast && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-emerald-50 border border-emerald-300 text-emerald-700' : 'bg-red-50 border border-red-300 text-red-700'}`}>
          {toast.message}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-300 text-red-700 px-4 py-3 text-sm font-medium">
          {actionError}
        </div>
      )}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Email</p>
            <p className="text-gray-900">{user.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Plano</p>
            <p className="text-gray-900">{user.plan}</p>
          </div>
          {!isSupport && isAdminDetail(user) && (
            <>
              <div>
                <p className="text-gray-500">Leads usados / limite</p>
                <p className="text-gray-900">{user.leadsUsed} / {user.leadsLimit}</p>
              </div>
              <div>
                <p className="text-gray-500">Onboarding</p>
                <p className="text-gray-900">{user.onboardingCompletedAt ? 'Concluído' : 'Pendente'}</p>
              </div>
              <div>
                <p className="text-gray-500">Empresa</p>
                <p className="text-gray-900">{user.companyName ?? '—'}</p>
              </div>
            </>
          )}
          <div>
            <p className="text-gray-500">Status da conta</p>
            <p className="text-gray-900">{disabledAt ? 'Desativada' : 'Ativa'}</p>
          </div>
          <div>
            <p className="text-gray-500">Criado em</p>
            <p className="text-gray-900">{new Date(user.createdAt).toLocaleString('pt-BR')}</p>
          </div>
        </div>
        {isSupport && (
          <div>
            <p className="text-gray-500 text-sm mb-2">Perfil (negócio)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Onboarding</p>
                <p className="text-gray-900">{(user as SupportUserDetail).onboardingCompletedAt ? 'Concluído' : 'Pendente'}</p>
              </div>
              <div>
                <p className="text-gray-500">Empresa</p>
                <p className="text-gray-900">{(user as SupportUserDetail).companyName ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Produto/serviço</p>
                <p className="text-gray-900">{(user as SupportUserDetail).productService ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Público-alvo</p>
                <p className="text-gray-900">{(user as SupportUserDetail).targetAudience ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-500">Principal benefício</p>
                <p className="text-gray-900">{(user as SupportUserDetail).mainBenefit ?? '—'}</p>
              </div>
            </div>
          </div>
        )}
        {workspacesList.length > 0 && (
          <div>
            <p className="text-gray-500 text-sm mb-2">Workspaces</p>
            <ul className="space-y-1">
              {workspacesList.map((w) => (
                <li key={w.id}>
                  {isSupport ? (
                    <span className="text-gray-600 text-sm">{w.name ?? w.id}</span>
                  ) : (
                    <Link
                      to={`../workspaces/${w.id}`}
                      className="text-violet-600 hover:text-violet-700 text-sm"
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
      <ResetPasswordModal
        open={showResetPasswordModal}
        mode={resetPasswordMode}
        tempPassword={tempPassword}
        actionLoading={actionLoading}
        onClose={() => { setShowResetPasswordModal(false); setTempPassword(''); setActionError(null); }}
        onModeChange={setResetPasswordMode}
        onTempPasswordChange={setTempPassword}
        onConfirm={handleResetPassword}
      />
      <DeactivateModal
        open={showDeactivateModal}
        reason={deactivateReason}
        actionLoading={actionLoading}
        onClose={() => setShowDeactivateModal(false)}
        onReasonChange={setDeactivateReason}
        onConfirm={() => handleDeactivate(deactivateReason.trim() || undefined)}
      />
    </div>
  );
}
