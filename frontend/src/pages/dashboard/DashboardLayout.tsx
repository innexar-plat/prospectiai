import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sun, Moon, Bell, BellOff, Target, X, AlertTriangle, Menu, User, Settings, CreditCard, LogOut, ChevronDown, Sparkles, Building2, Share2, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { InstallPrompt } from "@/components/dashboard/InstallPrompt";
import { CommandPalette, CommandPaletteTrigger } from "@/components/dashboard/CommandPalette";
import { TeamProgressCard } from "@/components/dashboard/TeamProgressCard";
import { DashboardTourTrigger } from "@/components/dashboard/DashboardTourTrigger";
import { ReleaseNotesBanner } from "@/components/dashboard/ReleaseNotesBanner";
import { TrialBanner } from "@/components/dashboard/TrialBanner";
import { authApi, notificationsApi, pushApi, userApi, type SessionUser, type NotificationItem } from '@/lib/api';
import { isCheckoutDone } from '@/lib/post-auth-redirect';
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { SearchResultsProvider } from "@/contexts/SearchResultsContext";
import { APP_VERSION } from "@/lib/version";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { needsSubscription, US_STARTER_CREDITS } from "@/lib/market";
import { useI18n } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/locale";
import { getAppOrigin } from "@/lib/site-url";
import { formatCreditCount, getRemainingCredits } from '@/lib/credits-display';

const BREADCRUMB_KEYS: Record<string, string> = {
  '/dashboard': 'dash.nav.newSearch',
  '/dashboard/historico': 'dash.nav.history',
  '/dashboard/leads': 'dash.nav.savedLeads',
  '/dashboard/resultados': 'dash.nav.results',
  '/dashboard/concorrencia': 'dash.nav.competition',
  '/dashboard/pipeline': 'dash.nav.pipeline',
  '/dashboard/relatorios': 'dash.nav.reports',
  '/dashboard/minha-empresa': 'dash.nav.myCompany',
  '/dashboard/viabilidade': 'dash.nav.viability',
  '/dashboard/equipe': 'dash.nav.myTeam',
  '/dashboard/equipe/dashboard': 'dash.nav.teamDashboard',
  '/dashboard/perfil': 'dash.nav.profile',
  '/dashboard/empresa': 'dash.nav.company',
  '/dashboard/planos': 'dash.breadcrumb.plans',
  '/dashboard/afiliado': 'dash.nav.affiliate',
  '/dashboard/configuracoes': 'dash.menu.settings',
  '/dashboard/integracoes': 'dash.nav.integrations',
  '/dashboard/suporte': 'dash.nav.help',
};

export function DashboardLayout({ user }: { user: SessionUser }) {
  const { t, locale, setLocale, preloadLocale } = useI18n();
  const dateLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US';
  const remainingCredits = getRemainingCredits(user);
  const breadcrumbFor = (path: string) => {
    const key = BREADCRUMB_KEYS[path];
    if (key) return t(key);
    if (path.startsWith('/dashboard/lead/')) return t('dash.breadcrumb.leadDetail');
    return t('dash.breadcrumb.page');
  };
  const navigate = useNavigate();
  const location = useLocation();
  const userNeedsSubscription = needsSubscription(user);
  useKeyboardShortcuts();
  const [checked, setChecked] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const refreshUser = useCallback(() => window.dispatchEvent(new Event('refresh-user')), []);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [metasModalOpen, setMetasModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [avatarDropdownOpen, setAvatarDropdownOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<NotificationItem[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(() => localStorage.getItem('notif-banner-dismissed') === '1');
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await notificationsApi.list({ limit: 20 });
      setNotifItems(res.items);
      setNotifUnreadCount(res.unreadCount);
    } catch {
      setNotifItems([]);
      setNotifUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  };

  const openNotifDropdown = () => {
    if (!notifDropdownOpen) fetchNotifications();
    setNotifDropdownOpen((v) => !v);
  };

  const markNotifRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    try {
      await notificationsApi.markRead(item.id);
      setNotifItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setNotifUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleNotifClick = (item: NotificationItem) => {
    markNotifRead(item);
    if (item.link) navigate(item.link);
    setNotifDropdownOpen(false);
  };

  useEffect(() => {
    const needsPlanAction = user.trialExpired || userNeedsSubscription;
    if (!needsPlanAction) return;

    const targetPath =
      user.requiresOnboarding && !isCheckoutDone() ? '/checkout' : '/dashboard/planos';

    if (!location.pathname.startsWith(targetPath)) {
      navigate(targetPath, { replace: true });
    }
  }, [user.trialExpired, userNeedsSubscription, user.requiresOnboarding, location.pathname, navigate]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(target)) {
        setNotifDropdownOpen(false);
      }
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(target)) {
        setAvatarDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Subscribe to Web Push after permission is granted
  const subscribeToPush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (!reg) return;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
          || (await pushApi.getVapidKey().catch(() => null))?.publicKey;
        if (!vapidKey) return;
        const urlBase64 = Uint8Array.from(atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64 });
      }
      const json = sub.toJSON();
      if (json.endpoint && json.keys) {
        await pushApi.subscribe(json).catch(() => {});
      }
    } catch {
      // Push subscription failed — silent
    }
  }, []);

  const requestBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === 'granted') subscribeToPush();
  };

  // Auto-subscribe to push if permission already granted
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribeToPush();
    }
  }, [subscribeToPush]);

  // SEO: set noindex for dashboard pages and update title per route
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';

    const label = breadcrumbFor(location.pathname);
    document.title = `${label} | Precision`;

    return () => {
      if (meta) meta.content = 'index, follow';
    };
  }, [location.pathname, t]);

  // Poll unread count every 30s so badge updates without clicking
  useEffect(() => {
    if (!user) return;
    let failures = 0;
    const poll = () => {
      notificationsApi.list({ limit: 1 }).then(res => {
        failures = 0;
        setNotifUnreadCount(res.unreadCount);
      }).catch(() => {
        failures += 1;
        if (failures >= 3) setNotifUnreadCount(0);
      });
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [user]);

  // Heartbeat: let backend know user is online (Redis presence key with TTL)
  useEffect(() => {
    if (!user) return;
    const ping = () => {
      fetch('/api/user/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
    };
    ping();
    const hbId = setInterval(ping, 30_000);
    return () => clearInterval(hbId);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkoutDone = isCheckoutDone();

    if (user.requiresOnboarding) {
      if (!checkoutDone) {
        navigate('/checkout', { replace: true });
        return;
      }
      if (!location.pathname.startsWith('/onboarding')) {
        navigate('/onboarding', { replace: true });
        return;
      }
    }
    setChecked(true);
  }, [user, navigate, location.pathname]);

  const handleLogout = async () => {
    try {
      await authApi.signOut();
    } catch {
      // Ignore
    }
    localStorage.removeItem('prospector-session');
    sessionStorage.clear();
    window.location.replace("/auth/signin");
  };

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">{t('dash.common.loading')}</div>
    );
  }

  // Gate: email verification required before using dashboard (checkout is outside this shell)
  const pendingCheckout = user.requiresOnboarding && !isCheckoutDone();
  if (user.emailVerified === false && !pendingCheckout) {
    return <EmailVerificationGate user={user} onLogout={handleLogout} onVerified={refreshUser} />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      <SidebarNav
        user={user}
        onLogout={handleLogout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-12 shrink-0 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 sm:px-5 z-40 text-foreground">
          {/* Left side: hamburger + breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setSidebarOpen(true);
              }}
              className="md:hidden p-2 -ml-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              aria-label={t('dash.menu.open')}
            >
              <Menu size={20} />
            </button>
            {/* Dynamic breadcrumb */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-muted min-w-0" aria-label={t('dash.a11y.breadcrumb')}>
              <Link to="/dashboard" className="hover:text-foreground transition-colors shrink-0">{t('dash.breadcrumb.dashboard')}</Link>
              {location.pathname !== '/dashboard' && (
                <>
                  <span className="text-muted/40">/</span>
                  <span className="text-foreground font-medium truncate">
                    {breadcrumbFor(location.pathname)}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-0.5 mr-1">
              {(['pt', 'en', 'es'] as SupportedLocale[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onMouseEnter={() => preloadLocale(lang)}
                  onFocus={() => preloadLocale(lang)}
                  onClick={() => setLocale(lang)}
                  className={cn(
                    'text-[10px] font-bold px-2 py-1 rounded-md transition-all uppercase',
                    locale === lang ? 'bg-violet-600 text-white' : 'text-muted hover:text-foreground',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
            <CommandPaletteTrigger />

            {/* Credits badge */}
            <Link
              to="/dashboard/planos"
              data-tour="header-credits"
              className={cn(
                'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-xs font-bold',
                userNeedsSubscription
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:shadow-md hover:shadow-violet-600/30'
                  : 'bg-violet-600/10 hover:bg-violet-600/20 text-violet-500',
              )}
              title={
                userNeedsSubscription
                  ? t('dash.credits.tooltipSubscribe')
                  : t('dash.credits.tooltip', { used: user.leadsUsed, limit: user.leadsLimit })
              }
            >
              <Sparkles size={13} />
              {userNeedsSubscription ? (
                <span>{t('dash.credits.subscribeCta', { count: US_STARTER_CREDITS })}</span>
              ) : (
                <>
                  <span className="tabular-nums">{formatCreditCount(remainingCredits, dateLocale)}</span>
                  <span className={cn('text-[10px] font-normal', !userNeedsSubscription && 'text-violet-600 dark:text-violet-400/70')}>{t('dash.credits.label')}</span>
                </>
              )}
            </Link>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
              aria-label={theme === 'dark' ? t('dash.theme.toggleLight') : t('dash.theme.toggleDark')}
              title={theme === 'dark' ? t('dash.theme.light') : t('dash.theme.dark')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Install App */}
            <InstallPrompt />

            {/* Notifications Bell + Dropdown */}
            <div className="relative" ref={notifDropdownRef} data-tour="header-notifications">
              <button
                type="button"
                onClick={openNotifDropdown}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors relative"
                aria-label={t('dash.notif.title')}
                title={t('dash.notif.title')}
                aria-expanded={notifDropdownOpen}
              >
                {notifPerm === 'denied' ? <BellOff size={16} /> : <Bell size={16} />}
                {notifUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-semibold">
                    {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                  </span>
                )}
              </button>
              {notifDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-[320px] max-h-[400px] overflow-hidden rounded-xl border border-border bg-card shadow-xl z-50 flex flex-col"
                  role="dialog"
                  aria-label={t('dash.a11y.notifList')}
                >
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="font-medium text-sm">{t('dash.notif.title')}</span>
                    {notifPerm !== 'granted' && notifPerm !== 'denied' && (
                      <button
                        type="button"
                        onClick={requestBrowserNotifications}
                        className="text-xs text-violet-500 hover:underline"
                      >
                        {t('dash.notif.enableBrowser')}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[120px]">
                    {(() => {
                      if (notifLoading) return <div className="p-4 text-center text-muted text-sm">{t('dash.notif.loading')}</div>;
                      if (notifItems.length === 0) return <div className="p-4 text-center text-muted text-sm">{t('dash.notif.empty')}</div>;
                      return (
                      <ul className="py-1">
                        {notifItems.map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handleNotifClick(item)}
                              className={cn(
                                'w-full text-left px-3 py-2.5 hover:bg-surface transition-colors border-b border-border/50 last:border-0',
                                !item.readAt && 'bg-violet-500/5'
                              )}
                            >
                              <div className="font-medium text-sm truncate">{item.title}</div>
                              <div className="text-xs text-muted truncate mt-0.5">{item.message}</div>
                              <div className="text-[10px] text-muted mt-1">
                                {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Metas (SCALE only) */}
            {user.plan === 'SCALE' && (
              <button
                type="button"
                onClick={() => setMetasModalOpen(true)}
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                aria-label={t('dash.notif.goals')}
                title={t('dash.notif.goals')}
              >
                <Target size={18} />
              </button>
            )}

            {/* User Avatar + Dropdown */}
            <div className="relative ml-1" ref={avatarDropdownRef} data-tour="header-avatar">
              <button
                type="button"
                onClick={() => setAvatarDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-violet-500/30 transition-colors"
                aria-label={t('dash.menu.account')}
                aria-expanded={avatarDropdownOpen}
                aria-haspopup="true"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center font-semibold text-[10px] text-violet-600 dark:text-violet-400">
                    {user.name?.[0] || user.email?.[0] || 'U'}
                  </div>
                )}
                <ChevronDown size={12} className={cn('text-muted transition-transform', avatarDropdownOpen && 'rotate-180')} />
              </button>
              {avatarDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-xl z-50 py-1"
                  role="menu"
                  aria-label={t('dash.menu.account')}
                >
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-medium text-sm text-foreground truncate">{user.name || t('dash.greeting.defaultUser')}</p>
                    <p className="text-xs text-muted truncate">{user.email ?? ''}</p>
                  </div>
                  <Link
                    to="/dashboard/perfil"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <User size={16} className="text-muted shrink-0" />
                    {t('dash.menu.myProfile')}
                  </Link>
                  <Link
                    to="/dashboard/configuracoes"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Settings size={16} className="text-muted shrink-0" />
                    {t('dash.menu.settings')}
                  </Link>
                  <Link
                    to="/dashboard/planos"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <CreditCard size={16} className="text-muted shrink-0" />
                    {t('dash.menu.plans')}
                  </Link>
                  <Link
                    to="/dashboard/empresa"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Building2 size={16} className="text-muted shrink-0" />
                    {t('dash.nav.company')}
                  </Link>
                  <Link
                    to="/dashboard/afiliado"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Share2 size={16} className="text-muted shrink-0" />
                    {t('dash.nav.affiliate')}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors text-left"
                    onClick={() => {
                      setAvatarDropdownOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut size={16} className="text-muted shrink-0" />
                    {t('dash.logout')}
                  </button>
                  <div className="px-3 py-1.5 border-t border-border">
                    <p className="text-[10px] text-muted/50 text-center">v{APP_VERSION}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Command Palette */}
        <CommandPalette />

        {/* Grace period banner: past_due, 3-day warning */}
        {user.subscriptionStatus === 'past_due' && (
          <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium">
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
            <span>{t('dash.pastDue.banner')}</span>
            <Link
              to="/dashboard/planos"
              className="underline font-semibold hover:no-underline shrink-0"
            >
              {t('dash.upgrade.viewPlans')}
            </Link>
          </div>
        )}

        {/* Notification permission prompt banner */}
        {notifPerm === 'default' && !notifBannerDismissed && (
          <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-violet-600/90 text-white text-xs sm:text-sm font-medium">
            <Bell size={16} className="shrink-0" aria-hidden />
            <span className="truncate sm:whitespace-normal">{t('dash.notif.banner')}</span>
            <button
              type="button"
              onClick={requestBrowserNotifications}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors shrink-0"
            >
              {t('dash.notif.activate')}
            </button>
            <button
              type="button"
              onClick={() => { setNotifBannerDismissed(true); localStorage.setItem('notif-banner-dismissed', '1'); }}
              className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
              aria-label={t('dash.notif.close')}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <ReleaseNotesBanner />
        <div className="px-4 sm:px-6 pt-4 max-w-6xl mx-auto w-full">
          <TrialBanner user={user} />
        </div>

        {/* Main Content */}
        <main className={cn("flex-1 flex flex-col overflow-y-auto relative min-w-0 text-foreground")} role="main">
          <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" aria-hidden />
          <DashboardTourTrigger />
          <SearchResultsProvider>
            <div className="flex-1 min-h-0">
              <Outlet context={{ user, refreshUser }} />
            </div>
          </SearchResultsProvider>
        </main>

        {/* Metas modal (SCALE) */}
        {metasModalOpen && user.plan === 'SCALE' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setMetasModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t('dash.notif.goals')}
          >
            <div
              className="bg-card border border-border rounded-3xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 flex items-center justify-end p-2 border-b border-border">
                <button
                  type="button"
                  onClick={() => setMetasModalOpen(false)}
                  className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                  aria-label={t('dash.upgrade.close')}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <TeamProgressCard plan={user.plan} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Email Verification Gate ────────────────────────────────────────────── */

function EmailVerificationGate({
  user,
  onLogout,
  onVerified,
}: {
  user: SessionUser;
  onLogout: () => void;
  onVerified: () => void;
}) {
  const { t } = useI18n();
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user.emailVerified !== false) return;
    const poll = () => {
      userApi.me()
        .then((res) => {
          if (res.user?.emailVerified) {
            onVerified();
          }
        })
        .catch(() => {});
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [user.emailVerified, onVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      const res = await authApi.resendVerification();
      if (res.sent) {
        setSent(true);
        setCooldown(res.cooldown ?? 60);
      } else if (res.error) {
        setError(res.error);
        if (res.cooldown) setCooldown(res.cooldown);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('dash.emailVerify.resendError');
      if (msg.includes('Aguarde') || msg.includes('Wait')) {
        const match = msg.match(/(\d+)/);
        if (match) setCooldown(parseInt(match[1], 10));
      }
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-background to-indigo-50 dark:from-violet-950/20 dark:via-background dark:to-indigo-950/20 text-foreground p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-violet-600 to-indigo-600" />

          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center shadow-sm">
              <Mail className="w-10 h-10 text-violet-600 dark:text-violet-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">{t('dash.emailVerify.title')}</h2>
              <p className="text-muted text-sm leading-relaxed">
                {t('dash.emailVerify.subtitle')}<br />
                <strong className="text-foreground">{user.email}</strong>
              </p>
            </div>

            <div className="bg-surface/50 border border-border rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">1.</span> {t('dash.emailVerify.step1')} <strong>Precision</strong>
              </p>
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">2.</span> {t('dash.emailVerify.step2')}
              </p>
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">3.</span> {t('dash.emailVerify.step3')}
              </p>
            </div>

            <div className="space-y-3">
              {sent && (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg py-2 px-3">
                  <CheckCircle2 size={16} />
                  <span>{t('dash.emailVerify.sent')}</span>
                </div>
              )}
              {error && !error.includes('Aguarde') && !error.includes('Wait') && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg py-2 px-3">
                  {error}
                </div>
              )}
              <button
                onClick={handleResend}
                disabled={cooldown > 0 || sending}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                  cooldown > 0 || sending
                    ? "bg-surface text-muted cursor-not-allowed border border-border"
                    : "bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-md hover:shadow-lg"
                )}
              >
                <RefreshCw size={16} className={cn(sending && "animate-spin")} />
                {sending
                  ? t('dash.emailVerify.sending')
                  : cooldown > 0
                    ? t('dash.emailVerify.resendIn', { count: cooldown })
                    : t('dash.emailVerify.resend')}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted">{t('dash.emailVerify.or')}</span>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-foreground rounded-xl border border-border hover:bg-surface transition-all duration-200"
            >
              <LogOut size={16} />
              {t('dash.emailVerify.logout')}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Precision &middot; {getAppOrigin().replace(/^https?:\/\//, '')}
        </p>
      </div>
    </div>
  );
}
