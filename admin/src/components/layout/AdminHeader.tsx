import { useLocation } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';
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
  'email-analytics': 'Email Analytics',
  'email-templates': 'Templates Email',
  'email-campaigns': 'Campanhas',
  'email-weekly-report': 'Relatório Semanal',
  'email-logs': 'Logs de Email',
  'auto-prospeccao/templates': 'Templates de Email',
  'auto-prospeccao/search-profiles': 'Perfis de Busca',
  'auto-prospeccao/sender-pool': 'Pool de Remetentes',
  'auto-prospeccao/config': 'Configurações Auto-Prospecção',
};

function getPageTitle(pathname: string): string {
  const clean = pathname.replace(/^\/+/, '').replace(/\/$/, '');
  if (!clean) return 'Dashboard';

  if (pathToTitle[clean]) return pathToTitle[clean];

  const first = clean.split('/')[0] ?? '';
  return pathToTitle[first] ?? 'Painel';
}

export function AdminHeader({ user, onMenuToggle }: { user: SessionUser; onMenuToggle?: () => void }) {
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
    <header className="h-14 shrink-0 border-b border-gray-200 bg-white flex items-center justify-between px-4 sm:px-6 shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-base font-semibold text-gray-800 truncate">{pageTitle}</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <span className="text-sm text-gray-500 truncate max-w-[100px] sm:max-w-[180px] hidden sm:inline">
          {user.email ?? user.name ?? 'Admin'}
        </span>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
