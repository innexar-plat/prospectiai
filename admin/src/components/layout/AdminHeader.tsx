import { useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/api';
import { authApi } from '@/lib/api';

const pathToTitle: Record<string, string> = {
  '': 'Dashboard',
  '/': 'Dashboard',
  users: 'Usuários',
  workspaces: 'Workspaces',
  leads: 'Leads',
  'search-history': 'Histórico de buscas',
  audit: 'Auditoria',
  'ai-config': 'IA / Provedores',
  'crm-integrations': 'Integrações CRM',
  email: 'Email',
  notifications: 'Notificações',
  plans: 'Planos',
  affiliates: 'Afiliados',
  commissions: 'Comissões',
  referrals: 'Referrals',
  'affiliate-settings': 'Config. Afiliados',
  profile: 'Perfil',
};

function getPageTitle(pathname: string): string {
  const segment = pathname.replace(/^\//, '').split('/')[0] ?? '';
  return pathToTitle[segment] ?? 'Painel';
}

export function AdminHeader({ user }: { user: SessionUser }) {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  const handleSignOut = async () => {
    try {
      await authApi.signOut();
    } catch {
      // ignore
    }
    const origin = window.location.origin;
    window.location.href = `${origin}/auth/signin`;
  };

  return (
    <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800 truncate">{pageTitle}</h2>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 truncate max-w-[180px]">
          {user.email ?? user.name ?? 'Admin'}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
