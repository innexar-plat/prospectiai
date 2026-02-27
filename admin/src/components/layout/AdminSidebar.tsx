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
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { to: '.', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: 'users', end: false, label: 'Usuários', icon: Users },
  { to: 'workspaces', end: false, label: 'Workspaces', icon: Building2 },
  { to: 'leads', end: false, label: 'Leads', icon: FileText },
  { to: 'search-history', end: false, label: 'Histórico de buscas', icon: History },
  { to: 'audit', end: false, label: 'Auditoria', icon: ClipboardList },
  { to: 'ai-config', end: false, label: 'IA / Provedores', icon: Bot },
  { to: 'email', end: false, label: 'Email', icon: Mail },
  { to: 'notifications', end: false, label: 'Notificações', icon: Bell },
  { to: 'plans', end: false, label: 'Planos', icon: CreditCard },
] as const;

export function AdminSidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900/80 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="font-semibold text-white">Painel Admin</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Prospector.AI</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-violet-600/20 text-violet-300'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
