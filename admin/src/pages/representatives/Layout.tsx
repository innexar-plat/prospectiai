import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Users, BarChart3, Layers } from 'lucide-react';

const tabs = [
  { to: '.', end: true, label: 'Representantes', icon: Users },
  { to: 'niveis', end: false, label: 'Níveis', icon: Layers },
  { to: 'relatorios', end: false, label: 'Relatórios', icon: BarChart3 },
];

export function RepresentativesLayout() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Representantes Comerciais</h1>
      <nav className="border-b border-gray-200 mb-6" aria-label="Abas">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors',
                  isActive
                    ? 'border-violet-500 text-violet-700 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-600',
                )
              }
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
