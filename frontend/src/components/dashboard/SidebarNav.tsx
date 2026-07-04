import { NavLink, useLocation, Link } from 'react-router-dom';
import { Search, Clock, Target, BarChart3, LogOut, Swords, TrendingUp, Users, LayoutDashboard, HelpCircle, ChevronDown, X, Lock, Building2, PanelLeftClose, PanelLeft, Plug, Sparkles, Layers, Crosshair, Bot, CreditCard } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { LogoIcon } from '@/components/brand/LogoIcon';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/api';
import { getPlanDisplayName } from '@/lib/billing-config';
import { isMarketFeatureEnabled, needsSubscription, US_STARTER_CREDITS } from '@/lib/market';
import { formatCreditUsage } from '@/lib/credits-display';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { APP_VERSION } from '@/lib/version';
import { useI18n } from '@/lib/i18n';

type SidebarItem = {
  to: string;
  end: boolean;
  icon: typeof Search;
  labelKey: string;
  badge?: 'PRO' | 'BIZ' | 'SCALE';
};

type SidebarSection = {
  id: string;
  titleKey: string;
  collapsible?: boolean;
  items: SidebarItem[];
};

const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'prospection',
    titleKey: 'dash.section.prospection',
    items: [
      { to: '/dashboard', end: true, icon: Search, labelKey: 'dash.nav.newSearch' },
      { to: '/dashboard/historico', end: false, icon: Clock, labelKey: 'dash.nav.history' },
      { to: '/dashboard/leads', end: false, icon: Target, labelKey: 'dash.nav.savedLeads' },
    ],
  },
  {
    id: 'intelligence',
    titleKey: 'dash.section.intelligence',
    collapsible: true,
    items: [
      { to: '/dashboard/concorrencia', end: false, icon: Swords, labelKey: 'dash.nav.competition', badge: 'PRO' },
      { to: '/dashboard/pipeline', end: false, icon: Crosshair, labelKey: 'dash.nav.pipeline', badge: 'PRO' },
      { to: '/dashboard/mercado', end: false, icon: TrendingUp, labelKey: 'dash.nav.marketIntel', badge: 'BIZ' },
      { to: '/dashboard/relatorios', end: false, icon: BarChart3, labelKey: 'dash.nav.reports', badge: 'BIZ' },
      { to: '/dashboard/minha-empresa', end: false, icon: Building2, labelKey: 'dash.nav.myCompany', badge: 'BIZ' },
      { to: '/dashboard/viabilidade', end: false, icon: Layers, labelKey: 'dash.nav.viability', badge: 'SCALE' },
    ],
  },
  {
    id: 'team',
    titleKey: 'dash.section.team',
    items: [
      { to: '/dashboard/equipe', end: false, icon: Users, labelKey: 'dash.nav.myTeam', badge: 'SCALE' },
      { to: '/dashboard/equipe/dashboard', end: true, icon: LayoutDashboard, labelKey: 'dash.nav.teamDashboard', badge: 'SCALE' },
    ],
  },
  {
    id: 'auto-prospeccao',
    titleKey: 'dash.section.autoProspeccao',
    collapsible: true,
    items: [
      { to: '/dashboard/auto-prospeccao', end: true, icon: Bot, labelKey: 'dash.nav.autoOverview' },
      { to: '/dashboard/auto-prospeccao/leads', end: false, icon: Target, labelKey: 'dash.nav.autoLeads' },
      { to: '/dashboard/auto-prospeccao/perfis', end: false, icon: Search, labelKey: 'dash.nav.autoProfiles' },
      { to: '/dashboard/auto-prospeccao/historico', end: false, icon: Clock, labelKey: 'dash.nav.autoHistory' },
    ],
  },
  {
    id: 'affiliates',
    titleKey: 'dash.section.affiliates',
    collapsible: true,
    items: [
      { to: '/dashboard/afiliado', end: true, icon: Users, labelKey: 'dash.nav.affiliateOverview' },
      { to: '/dashboard/afiliado/dicas', end: false, icon: HelpCircle, labelKey: 'dash.nav.affiliateTips' },
      { to: '/dashboard/afiliado/conversoes', end: false, icon: TrendingUp, labelKey: 'dash.nav.affiliateConversions' },
      { to: '/dashboard/afiliado/comissoes', end: false, icon: BarChart3, labelKey: 'dash.nav.affiliateCommissions' },
      { to: '/dashboard/afiliado/materiais', end: false, icon: Layers, labelKey: 'dash.nav.affiliateMaterials' },
      { to: '/dashboard/afiliado/pagamento', end: false, icon: Clock, labelKey: 'dash.nav.affiliatePayment' },
    ],
  },
  {
    id: 'account',
    titleKey: 'dash.section.account',
    items: [
      { to: '/dashboard/planos', end: false, icon: CreditCard, labelKey: 'dash.nav.plans' },
    ],
  },
  {
    id: 'support',
    titleKey: 'dash.section.support',
    items: [
      { to: '/dashboard/integracoes', end: false, icon: Plug, labelKey: 'dash.nav.integrations' },
      { to: '/dashboard/suporte', end: false, icon: HelpCircle, labelKey: 'dash.nav.help' },
    ],
  },
];

const SIDEBAR_COLLAPSED_KEY = 'prospector_sidebar_collapsed';
const SIDEBAR_WIDTH_EXPANDED = 224;
const SIDEBAR_WIDTH_COLLAPSED = 72;

const PLAN_ORDER: string[] = ['FREE', 'TRIAL', 'BASIC', 'PRO', 'BUSINESS', 'SCALE'];
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

function getStoredSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
}

function setStoredSidebarCollapsed(value: boolean): void {
  if (typeof window === 'undefined') return;
  if (value) window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
  else window.localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
}

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
  const { t, locale } = useI18n();
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getStoredSidebarCollapsed);
  const [upgradeModal, setUpgradeModal] = useState<{ planName: string; feature: string } | null>(null);
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);

  const toggleSection = (id: string) =>
    setSectionCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      setStoredSidebarCollapsed(next);
      return next;
    });
  };

  useEffect(() => {
    if (prevPathnameRef.current === location.pathname) return;
    prevPathnameRef.current = location.pathname;
    onMobileClose?.();
  }, [location.pathname, onMobileClose]);

  useEffect(() => {
    if (!upgradeModal) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUpgradeModal(null);
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [upgradeModal]);

  function renderContent(isNarrow: boolean, showCollapseToggle: boolean) {
    const displayName = user.name?.trim() || user.email?.split('@')[0] || t('dash.greeting.defaultUser');
    const shortName = displayName.split(/\s+/)[0] || displayName;
    const numberLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US';
    const creditUsage = formatCreditUsage(user, numberLocale);
    const usedCreditsLabel = `${creditUsage.usedLabel}/${creditUsage.limitLabel}`;
    const userNeedsSubscription = needsSubscription(user);
    const upgradeCtaLabel = userNeedsSubscription
      ? t('dash.credits.subscribeCta', { count: US_STARTER_CREDITS })
      : t('dash.upgrade.cta');

    const logoBlock = (
      <div className={cn('flex items-center shrink-0', isNarrow ? 'justify-between py-1.5' : 'justify-between py-1 mb-1')}>
        <Link to="/dashboard" className="flex items-center gap-2 group min-w-0" aria-label="Precision">
          {isNarrow ? (
            <LogoIcon size={28} />
          ) : (
            <>
              <Logo height={32} className="max-w-[9.5rem]" />
              <span className="text-[10px] text-muted/45 leading-none select-none">v{APP_VERSION}</span>
            </>
          )}
        </Link>
        <div className="flex items-center gap-1">
          {showCollapseToggle && (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="p-1.5 rounded-lg text-muted/60 hover:text-foreground hover:bg-surface transition-colors"
              aria-label={isNarrow ? t('dash.sidebar.expand') : t('dash.sidebar.collapse')}
              title={isNarrow ? t('dash.sidebar.expand') : t('dash.sidebar.collapse')}
            >
              {isNarrow ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
          {onMobileClose && !isNarrow && (
            <button
              type="button"
              onClick={onMobileClose}
              className="md:hidden p-2 -mr-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
              aria-label={t('dash.sidebar.close')}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>
    );

    const itemClass = (active: boolean) =>
      cn(
        'group relative w-full flex items-center rounded-xl transition-all duration-200 text-[13px] border',
        active
          ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-violet-600 dark:text-violet-300 border-violet-500/25 shadow-sm shadow-violet-500/10'
          : 'text-muted border-transparent hover:text-foreground hover:bg-surface/80 hover:border-border/60 hover:shadow-sm'
      );

    const navContent = (
      <nav className="flex-1 space-y-4 overflow-y-auto scrollbar-thin" aria-label={t('dash.sidebar.navAria')} data-tour="sidebar-nav">
        {SIDEBAR_SECTIONS.filter((section) => {
          if (section.id === 'auto-prospeccao') {
            return isMarketFeatureEnabled('autoProspeccao') && !!user.autoProspeccaoEnabled;
          }
          return true;
        }).map((section, sectionIndex) => {
          const isSecCollapsed = sectionCollapsed[section.id];
          const sectionTitle = t(section.titleKey);
          return (
            <div key={section.id}>
              {!isNarrow && (
                <button
                  type="button"
                  onClick={() => section.collapsible && toggleSection(section.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 pb-1 mb-1.5',
                    sectionIndex > 0 ? 'pt-5' : 'pt-1',
                    section.collapsible ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted/70 select-none">
                    {sectionTitle}
                  </span>
                  {section.collapsible && (
                    <ChevronDown
                      size={12}
                      className={cn('text-muted/70 transition-transform', isSecCollapsed && '-rotate-90')}
                    />
                  )}
                </button>
              )}
              {(!isNarrow && !isSecCollapsed) || isNarrow ? (
                <div className={cn('space-y-0.5', isNarrow && 'space-y-1')}>
                  {section.items.map(({ to, end, icon: Icon, labelKey, badge }) => {
                    const label = t(labelKey);
                    const locked = badge && !hasPlanAccess(user.plan, badge);
                    const planName = badge ? BADGE_TO_PLAN_NAME[badge] : '';
                    const linkContent = (
                      <span className={cn('flex items-center min-w-0', isNarrow ? 'justify-center' : 'gap-2.5')}>
                        <span className="shrink-0 flex items-center justify-center" style={{ width: isNarrow ? undefined : 18 }}>
                          <Icon size={isNarrow ? 20 : 16} aria-hidden />
                        </span>
                        {!isNarrow && <span className="font-medium truncate">{label}</span>}
                      </span>
                    );
                    const tourId = to === '/dashboard/historico' ? 'sidebar-historico'
                      : to === '/dashboard/leads' ? 'sidebar-leads'
                      : to === '/dashboard/planos' ? 'sidebar-planos'
                      : to === '/dashboard/integracoes' ? 'sidebar-integracoes'
                      : to === '/dashboard/concorrencia' ? 'sidebar-inteligencia'
                      : to === '/dashboard/equipe' ? 'sidebar-equipe'
                      : undefined;
                    if (locked) {
                      return (
                        <button
                          key={to}
                          type="button"
                          data-tour={tourId}
                          onClick={() => setUpgradeModal({ planName, feature: label })}
                          title={isNarrow ? label : undefined}
                          className={cn(
                            itemClass(false),
                            isNarrow ? 'justify-center p-3 min-h-[44px]' : 'justify-between px-3 py-2 min-h-[38px]'
                          )}
                        >
                          {linkContent}
                          {!isNarrow && <Lock size={13} className="shrink-0 text-muted/50 ml-auto" aria-hidden />}
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
                        data-tour={tourId}
                        title={isNarrow ? label : undefined}
                        className={({ isActive }) =>
                          cn(
                            itemClass(isActive),
                            isNarrow ? 'justify-center p-3 min-h-[44px]' : 'justify-between px-3 py-2.5 min-h-[40px]',
                            isActive && !isNarrow && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-violet-500 before:to-indigo-500'
                          )
                        }
                      >
                        {() => linkContent}
                      </NavLink>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    );

    const footerBlock = (
      <div className={cn('mt-auto border-t border-border/50', isNarrow ? 'pt-2' : 'pt-2')}>
        <div className={cn('flex items-center rounded-xl transition-colors', isNarrow ? 'justify-center p-1.5' : 'gap-2 px-2.5 py-2 hover:bg-surface/60')}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center font-bold text-[11px] text-violet-500 shrink-0 ring-1 ring-violet-500/10" title={isNarrow ? `${displayName} · ${getPlanDisplayName(user.plan)}` : undefined}>
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
          {!isNarrow && (
            <>
              <p className="text-xs font-semibold truncate text-foreground leading-none max-w-[88px]">{shortName}</p>
              {!userNeedsSubscription && (
                <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-500 tabular-nums">
                  {usedCreditsLabel}
                </span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLogout(); }}
            className="ml-auto shrink-0 p-1.5 text-muted/50 hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-lg"
            aria-label={t('dash.logout')}
            title={t('dash.logout')}
          >
            <LogOut size={14} />
          </button>
        </div>

        {/* Upgrade CTA */}
        {user.plan !== 'SCALE' && (
          <div className={cn('px-2.5', isNarrow && 'px-1.5')}>
            <Link
              to="/dashboard/planos"
              data-tour="sidebar-upgrade"
              title={isNarrow ? upgradeCtaLabel : undefined}
              className={cn(
                'flex items-center rounded-xl bg-gradient-to-r from-violet-600 via-violet-600 to-indigo-600 text-white font-semibold transition-all duration-300',
                'hover:shadow-lg hover:shadow-violet-600/30 hover:-translate-y-0.5 hover:from-violet-500 hover:to-indigo-500',
                'ring-1 ring-white/10',
                isNarrow ? 'justify-center p-2.5' : 'gap-2 px-3 py-2.5 text-xs'
              )}
            >
              <Sparkles size={isNarrow ? 16 : 13} className="shrink-0" />
              {!isNarrow && <span>{upgradeCtaLabel}</span>}
            </Link>
          </div>
        )}
      </div>
    );

    return (
      <div className={cn('z-10 relative flex flex-col flex-1 min-h-0', isNarrow ? 'px-2 py-3' : 'px-3 pb-3 pt-3')}>
        {logoBlock}
        {navContent}
        {footerBlock}
      </div>
    );
  }

  return (
    <>
      <aside
        className="relative hidden md:flex flex-col overflow-hidden transition-[min-width] duration-300 ease-out border-r border-violet-500/10 bg-gradient-to-b from-card via-card to-card/95 backdrop-blur-xl shadow-[inset_-1px_0_0_0_rgba(139,92,246,0.06)]"
        style={{
          width: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
          minWidth: sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
        }}
        aria-label="Menu principal"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-600/[0.07] to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -left-20 top-1/4 h-40 w-40 rounded-full bg-violet-600/[0.04] blur-3xl" aria-hidden />
        {renderContent(sidebarCollapsed, true)}
      </aside>
      {mobileOpen && onMobileClose && typeof document !== 'undefined' && createPortal(
        <MobileSidebarWrapper onClose={onMobileClose}>
          <aside
            className="fixed left-0 top-0 bottom-0 w-64 max-w-[85vw] flex flex-col border-r border-violet-500/15 bg-gradient-to-b from-card via-card to-card/98 backdrop-blur-xl shadow-2xl shadow-violet-900/10 md:hidden animate-in slide-in-from-left-2 duration-200"
            style={{ zIndex: 9999 }}
            aria-label="Menu principal"
          >
            {renderContent(false, false)}
          </aside>
        </MobileSidebarWrapper>,
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
              {t('dash.upgrade.title', { plan: upgradeModal.planName })}
            </h2>
            <p className="text-sm text-muted mb-4">
              {t('dash.upgrade.desc', { feature: upgradeModal.feature, plan: upgradeModal.planName })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUpgradeModal(null)}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface transition-colors"
              >
                {t('dash.upgrade.close')}
              </button>
              <Link
                to="/dashboard/planos"
                onClick={() => setUpgradeModal(null)}
                className="flex-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium text-center transition-colors"
              >
                {t('dash.upgrade.viewPlans')}
              </Link>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MobileSidebarWrapper({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const focusable = wrapper.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0]?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const focusable = wrapper.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <div ref={wrapperRef} onKeyDown={handleKeyDown}>
      <div
        className="fixed inset-0 bg-black/50 md:hidden touch-manipulation"
        style={{ zIndex: 9998 }}
        onClick={onClose}
        onTouchEnd={(e) => { e.preventDefault(); onClose(); }}
        aria-hidden
        role="presentation"
      />
      {children}
    </div>
  );
}
