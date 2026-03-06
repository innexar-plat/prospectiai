import { useOutletContext } from 'react-router-dom';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

export function ProfilePage() {
  const { user } = useOutletContext<AdminLayoutContext>();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
      <h1 className="text-lg font-semibold text-white mb-4">Meu perfil</h1>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-zinc-500">Nome</dt>
          <dd className="text-zinc-200">{user?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">E-mail</dt>
          <dd className="text-zinc-200">{user?.email ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
