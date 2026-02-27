import { NavLink, useLocation, Link } from 'react-router-dom';
import { Search, Clock, Target, BarChart3, User, Settings, LogOut, Swords, TrendingUp, Users, LayoutDashboard, CreditCard, HelpCircle, ChevronDown, X, Lock, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/api';
import { getPlanDisplayName } from '@/lib/billing-config';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '@/components/brand/Logo';

const PLAN_ORDER: string[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];
const BADGE_TO_PLAN_NAME: Record<string, string> = {
  PRO: 'Growth',
  BIZ: 'Business',
  SCALE: 'Enterprise',
};

function hasPlanAccess(userPlan: string | undefined, requiredBadge: 'PRO' | 'BIZ' | 'SCALE'): boolean {
  const requiredPlan = requiredBadge === 'BIZ' ? 'BUSINESS' : requiredBadge;
  const userIdx = PLAN_ORDER.indexOf(userPlan ?? 'FREE');
  const requiredIdx = PLAN_ORDER.indexOf(requiredPlan);
  return userIdx >= 0 && requiredIdx >= 0 && userIdx >= requiredIdx;
}

type SidebarItem = {
  to: string;
  end: boolean;
  icon: typeof Search;
  label: string;
  badge?: 'PRO' | 'BIZ' | 'SCALE';
};

type SidebarSection = {
  title: string;
  collapsible?: boolean;
  items: SidebarItem[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Prospecção',
    items: [
      { to: '/dashboard', end: true, icon: Search, label: 'Nova Busca' },
      { to: '/dashboard/historico', end: false, icon: Clock, label: 'Histórico' },
      { to: '/dashboard/leads', end: false, icon: Target, label: 'Leads Salvos' },
    ],
  },
  {
    title: 'Inteligência',
    collapsible: true,
    items: [
      { to: '/dashboard/concorrencia', end: false, icon: Swords, label: 'Concorrência', badge: 'PRO' },
      { to: '/dashboard/relatorios', end: false, icon: BarChart3, label: 'Relatórios', badge: 'BIZ' },
      { to: '/dashboard/minha-empresa', end: false, icon: Building2, label: 'Análise minha empresa', badge: 'BIZ' },
      { to: '/dashboard/viabilidade', end: false, icon: TrendingUp, label: 'Viabilidade', badge: 'SCALE' },
    ],
  },
  {
    title: 'Equipe',
    items: [
      { to: '/dashboard/equipe', end: false, icon: Users, label: 'Minha Equipe', badge: 'SCALE' },
      { to: '/dashboard/equipe/dashboard', end: true, icon: LayoutDashboard, label: 'Dashboard da equipe', badge: 'SCALE' },
    ],
  },
  {
    title: 'Conta',
    collapsible: true,
    items: [
      { to: '/dashboard/perfil', end: false, icon: User, label: 'Perfil' },
      { to: '/dashboard/empresa', end: false, icon: Building2, label: 'Empresa' },
      { to: '/dashboard/planos', end: false, icon: CreditCard, label: 'Planos' },
      { to: '/dashboard/configuracoes', end: false, icon: Settings, label: 'Configurações' },
      { to: '/dashboard/suporte', end: false, icon: HelpCircle, label: 'Suporte' },
    ],
  },
];

export function SidebarNav({
  user,
  onLogout,
  mobileOpen = false,
  onMobileClose,
}: {
  user: SessionUser;
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [upgradeModal, setUpgradeModal] = useState<{ planName: string; feature: string } | null>(null);
  const location = useLocation();

  const toggle = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  useEffect(() => {
    if (mobileOpen && onMobileClose) onMobileClose();
  }, [location.pathname]);

  useEffect(() => {
    if (!upgradeModal) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUpgradeModal(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [upgradeModal]);

  const logoBlock = (
    <div className="mb-5 flex items-center justify-between gap-2">
      <Logo iconSize={28} iconOnly={false} className="gap-2 shrink-0" textClassName="font-bold text-sm tracking-tight truncate" />
      {onMobileClose && (
        <button
          type="button"
          onClick={onMobileClose}
          className="md:hidden p-2 -mr-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
          aria-label="Fechar menu"
        >
          <X size={20} />
        </button>
      )}
    </div>
  );

  const sidebarContent = (
    <div className="p-4 z-10 relative flex flex-col flex-1 min-h-0">
      {logoBlock}
      {/* Sections */}
        <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-thin" aria-label="Navegação do dashboard">
          {SIDEBAR_SECTIONS.map((section) => {
            const isCollapsed = collapsed[section.title];
            return (
              <div key={section.title}>
                {/* Section Title */}
                <button
                  type="button"
                  onClick={() => section.collapsible && toggle(section.title)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 mb-1.5',
                    section.collapsible ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  )}
                >
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted/70 select-none">
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <ChevronDown
                      size={12}
                      className={cn('text-muted/50 transition-transform', isCollapsed && '-rotate-90')}
                    />
                  )}
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map(({ to, end, icon: Icon, label, badge }) => {
                      const locked = badge && !hasPlanAccess(user.plan, badge);
                      const planName = badge ? BADGE_TO_PLAN_NAME[badge] : '';
                      if (locked) {
                        return (
                          <button
                            key={to}
                            type="button"
                            onClick={() => setUpgradeModal({ planName, feature: label })}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-[34px] text-[13px] text-muted hover:text-foreground hover:bg-surface border border-transparent'
                            )}
                          >
                            <span className="flex items-center gap-2.5 font-medium">
                              <Icon size={15} aria-hidden />
                              {label}
                            </span>
                            <Lock size={14} className="shrink-0 text-muted" aria-hidden />
                          </button>
                        );
                      }
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          className={({ isActive }) =>
                            cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-[34px] text-[13px]',
                              isActive
                                ? 'bg-violet-600/10 text-violet-500 border border-violet-500/20'
                                : 'text-muted hover:text-foreground hover:bg-surface border border-transparent'
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <span className="flex items-center gap-2.5 font-medium">
                                <Icon size={15} aria-hidden />
                                {label}
                              </span>
                              {isActive ? <span className="w-1 h-1 rounded-full bg-violet-500 shrink-0" aria-hidden /> : null}
                            </>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-3 space-y-3 border-t border-border/50">
          {/* Credits */}
          <div className="px-3 py-2 rounded-lg bg-surface border border-border">
            <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider text-muted">
              <span>Créditos</span>
              <span className="text-violet-500 tabular-nums">{user.leadsUsed}/{user.leadsLimit}</span>
            </div>
            <div className="h-1 w-full bg-background rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-violet-600 rounded-full transition-all"
                style={{ width: `${user.leadsLimit > 0 ? (user.leadsUsed / user.leadsLimit) * 100 : 0}%` }}
                role="progressbar"
                aria-valuenow={user.leadsUsed}
                aria-valuemin={0}
                aria-valuemax={user.leadsLimit}
              />
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-2 px-1 py-1.5 rounded-lg border border-transparent hover:bg-surface/50">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center font-semibold text-xs text-violet-400 shrink-0">
              {user.name?.[0] || user.email?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate text-foreground">{user.name || 'Usuário'}</p>
              <p className="text-[10px] text-muted truncate">{getPlanDisplayName(user.plan)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogout(); }}
              className="shrink-0 p-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-red-500/50"
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="w-56 min-w-[224px] bg-card border-r border-border flex flex-col relative overflow-hidden hidden md:flex"
        aria-label="Menu principal"
      >
        {sidebarContent}
      </aside>
      {/* Mobile drawer: portal so it's above everything on mobile (avoids overflow/z-index issues) */}
      {mobileOpen && onMobileClose && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 md:hidden touch-manipulation"
            style={{ zIndex: 9998 }}
            onClick={onMobileClose}
            onTouchEnd={(e) => { e.preventDefault(); onMobileClose(); }}
            onKeyDown={(e) => e.key === 'Escape' && onMobileClose()}
            aria-hidden
            role="presentation"
          />
          <aside
            className="fixed left-0 top-0 bottom-0 w-64 max-w-[85vw] bg-card border-r border-border flex flex-col shadow-xl md:hidden animate-in slide-in-from-left-2 duration-200"
            style={{ zIndex: 9999 }}
            aria-label="Menu principal"
          >
            {sidebarContent}
          </aside>
        </>,
        document.body
      )}

      {/* Modal de upgrade: recurso bloqueado */}
      {upgradeModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setUpgradeModal(null)}
          />
          <div className="relative rounded-xl border border-border bg-card p-6 shadow-xl max-w-sm w-full">
            <h2 id="upgrade-modal-title" className="text-lg font-semibold text-foreground mb-1">
              Recurso disponível no plano {upgradeModal.planName}
            </h2>
            <p className="text-sm text-muted mb-4">
              &quot;{upgradeModal.feature}&quot; faz parte do plano {upgradeModal.planName}. Faça upgrade para acessar.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUpgradeModal(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface transition-colors"
              >
                Fechar
              </button>
              <Link
                to="/dashboard/planos"
                onClick={() => setUpgradeModal(null)}
                className="flex-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium text-center transition-colors"
              >
                Ver planos
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
