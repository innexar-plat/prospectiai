import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { authApi, type SessionUser, type PanelRole } from '@/lib/api';

type GuardState =
  | { status: 'loading' }
  | { status: 'unauthorized' }
  | { status: 'forbidden' }
  | { status: 'ready'; user: SessionUser; role: PanelRole };

export function AdminGuard() {
  const [state, setState] = useState<GuardState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const { user } = await authApi.session();
        if (cancelled) return;
        if (!user) {
          const origin = window.location.origin;
          const callbackUrl = `${origin}/admin`;
          window.location.href = `${origin}/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
          setState({ status: 'unauthorized' });
          return;
        }
        const role = user.role ?? null;
        if (role !== 'admin' && role !== 'support') {
          setState({ status: 'forbidden' });
          return;
        }
        if (cancelled) return;
        setState({ status: 'ready', user, role });
      } catch {
        if (cancelled) return;
        const origin = window.location.origin;
        window.location.href = `${origin}/auth/signin?callbackUrl=${encodeURIComponent(origin + '/admin')}`;
        setState({ status: 'unauthorized' });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-300">
        Carregando…
      </div>
    );
  }

  if (state.status === 'unauthorized') {
    return null;
  }

  if (state.status === 'forbidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-300 p-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-white mb-2">Acesso negado</h1>
          <p className="text-zinc-400">
            Apenas administradores e suporte podem acessar este painel.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet context={{ user: state.user, role: state.role }} />;
}
