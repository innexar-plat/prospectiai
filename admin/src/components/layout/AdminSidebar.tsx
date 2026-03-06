import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  History,
  ClipboardList,
  Bot,
  CreditCard,
  Mail,
  Bell,
  Share2,
  Settings,
  UserPlus,
  DollarSign,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = { to: string; end: boolean; label: string; icon: typeof LayoutDashboard };
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { to: '.', end: true, label: 'Dashboard', icon: LayoutDashboard },
      { to: 'users', end: false, label: 'Usuários', icon: Users },
      { to: 'workspaces', end: false, label: 'Workspaces', icon: Building2 },
      { to: 'leads', end: false, label: 'Leads', icon: FileText },
      { to: 'search-history', end: false, label: 'Histórico de buscas', icon: History },
      { to: 'audit', end: false, label: 'Auditoria', icon: ClipboardList },
    ],
  },
  {
    title: 'Afiliados',
    items: [
      { to: 'affiliates', end: false, label: 'Afiliados', icon: Share2 },
      { to: 'commissions', end: false, label: 'Comissões', icon: DollarSign },
      { to: 'referrals', end: false, label: 'Referrals', icon: UserPlus },
      { to: 'affiliate-settings', end: false, label: 'Config. Afiliados', icon: Settings },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: 'ai-config', end: false, label: 'IA / Provedores', icon: Bot },
      { to: 'email', end: false, label: 'Email', icon: Mail },
      { to: 'notifications', end: false, label: 'Notificações', icon: Bell },
      { to: 'plans', end: false, label: 'Planos', icon: CreditCard },
    ],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
    isActive ? 'bg-violet-600/20 text-violet-300' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
  );

export function AdminSidebar() {
  return (
    <aside className="flex-shrink-0 w-56 border-r border-zinc-800 bg-zinc-900/80 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="font-semibold text-white text-sm">Painel Admin</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Prospector.AI</p>
      </div>
      <nav className="flex-1 flex flex-col min-h-0 p-2">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} className="mt-4 first:mt-0">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 px-3">
                {section.title}
              </h2>
              <div className="space-y-0.5">
                {section.items.map(({ to, end, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={end} className={linkClass}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-zinc-800">
          <NavLink to="profile" end={true} className={linkClass}>
            <User className="w-4 h-4 shrink-0" />
            Perfil
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
