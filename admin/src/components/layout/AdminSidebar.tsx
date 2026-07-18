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
  Cable,
  Share2,
  Settings,
  UserPlus,
  DollarSign,
  User,
  Send,
  BarChart3,
  TrendingUp,
  Search,
  Layers,
  MessageCircle,
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
    title: 'Canais de Vendas',
    items: [
      { to: 'representantes', end: false, label: 'Representantes', icon: Users },
      { to: 'representantes/niveis', end: false, label: 'Níveis', icon: Layers },
      { to: 'representantes/relatorios', end: false, label: 'Relatórios', icon: BarChart3 },
      { to: 'whatsapp', end: false, label: 'WhatsApp', icon: MessageCircle },
    ],
  },
  {
    title: 'Auto-Prospecção',
    items: [
      { to: 'auto-prospeccao/templates', end: false, label: 'Templates de Email', icon: Mail },
      { to: 'auto-prospeccao/search-profiles', end: false, label: 'Perfis de Busca', icon: Search },
      { to: 'auto-prospeccao/sender-pool', end: false, label: 'Pool de Remetentes', icon: Send },
      { to: 'auto-prospeccao/config', end: false, label: 'Configurações', icon: Settings },
    ],
  },
  {
    title: 'Email Marketing',
    items: [
      { to: 'email-analytics', end: false, label: 'Analytics', icon: TrendingUp },
      { to: 'email-logs', end: false, label: 'Logs de Email', icon: ClipboardList },
      { to: 'email-templates', end: false, label: 'Templates Email', icon: FileText },
      { to: 'email-campaigns', end: false, label: 'Campanhas', icon: Send },
      { to: 'email-weekly-report', end: false, label: 'Relatório Semanal', icon: BarChart3 },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: 'ai-config', end: false, label: 'IA / Provedores', icon: Bot },
      { to: 'crm-integrations', end: false, label: 'Integrações CRM', icon: Cable },
      { to: 'email', end: false, label: 'Email', icon: Mail },
      { to: 'notifications', end: false, label: 'Notificações', icon: Bell },
      { to: 'plans', end: false, label: 'Planos', icon: CreditCard },
    ],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    isActive ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  );

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex-shrink-0 w-60 border-r border-gray-200 bg-white flex flex-col overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <img
            src="/brands/precision-favicon.svg"
            alt=""
            aria-hidden
            className="w-8 h-8 object-contain"
          />
          <div>
            <h1 className="font-semibold text-gray-900 text-sm leading-tight">Painel Admin</h1>
            <p className="text-xs text-gray-400 leading-tight">Precision</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 flex flex-col min-h-0 p-2">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} className="mt-4 first:mt-0">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-3">
                {section.title}
              </h2>
              <div className="space-y-0.5">
                {section.items.map(({ to, end, label, icon: Icon }) => (
                  <NavLink key={to} to={to} end={end} className={linkClass} onClick={onNavigate}>
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-gray-200">
          <NavLink to="profile" end={true} className={linkClass} onClick={onNavigate}>
            <User className="w-4 h-4 shrink-0" />
            Perfil
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
