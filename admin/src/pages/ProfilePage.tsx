import { useOutletContext } from 'react-router-dom';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

export function ProfilePage() {
  const { user } = useOutletContext<AdminLayoutContext>();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-gray-900 mb-4">Meu perfil</h1>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-gray-500">Nome</dt>
          <dd className="text-gray-700">{user?.name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-500">E-mail</dt>
          <dd className="text-gray-700">{user?.email ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
