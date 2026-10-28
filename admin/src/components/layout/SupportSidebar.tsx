import { NavLink } from 'react-router-dom';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Support role has no admin dashboard — only user lookup tools. */
const nav = [{ to: 'users', end: false, label: 'Usuários', icon: Users }] as const;

export function SupportSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}brands/precision-favicon.svg?v=4`}
            alt=""
            aria-hidden
            className="w-8 h-8 object-contain"
          />
          <div>
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">Painel Suporte</h1>
            <p className="text-xs text-gray-400 leading-tight">Precision</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
