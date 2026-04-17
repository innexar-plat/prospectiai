import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sun, Moon, Bell, BellOff, Target, X, AlertTriangle, Menu, User, Settings, CreditCard, LogOut, ChevronDown, Sparkles, Building2, Share2, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { InstallPrompt } from "@/components/dashboard/InstallPrompt";
import { CommandPalette, CommandPaletteTrigger } from "@/components/dashboard/CommandPalette";
import { TeamProgressCard } from "@/components/dashboard/TeamProgressCard";
import { DashboardTourTrigger } from "@/components/dashboard/DashboardTourTrigger";
import { ReleaseNotesBanner } from "@/components/dashboard/ReleaseNotesBanner";
import { authApi, notificationsApi, pushApi, type SessionUser, type NotificationItem } from '@/lib/api';
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { SearchResultsProvider } from "@/contexts/SearchResultsContext";
import { APP_VERSION } from "@/lib/version";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'Nova Busca',
  '/dashboard/historico': 'Histórico',
  '/dashboard/leads': 'Leads Salvos',
  '/dashboard/resultados': 'Resultados',
  '/dashboard/concorrencia': 'Concorrência',
  '/dashboard/pipeline': 'Pipeline Inteligente',
  '/dashboard/relatorios': 'Relatórios',
  '/dashboard/minha-empresa': 'Minha Empresa',
  '/dashboard/viabilidade': 'Viabilidade',
  '/dashboard/equipe': 'Minha Equipe',
  '/dashboard/equipe/dashboard': 'Dashboard da Equipe',
  '/dashboard/perfil': 'Perfil',
  '/dashboard/empresa': 'Empresa',
  '/dashboard/planos': 'Planos',
  '/dashboard/afiliado': 'Afiliado',
  '/dashboard/configuracoes': 'Configurações',
  '/dashboard/integracoes': 'Integrações',
  '/dashboard/suporte': 'Suporte',
};

export function DashboardLayout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const location = useLocation();
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

    const label = BREADCRUMB_MAP[location.pathname] || 'Dashboard';
    document.title = `${label} | PrecisionAI`;

    return () => {
      if (meta) meta.content = 'index, follow';
    };
  }, [location.pathname]);

  // Poll unread count every 30s so badge updates without clicking
  useEffect(() => {
    const poll = () => {
      notificationsApi.list({ limit: 1 }).then(res => {
        setNotifUnreadCount(res.unreadCount);
      }).catch(() => {});
    };
    poll(); // initial fetch
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  // Heartbeat: let backend know user is online (Redis presence key with TTL)
  useEffect(() => {
    const ping = () => {
      fetch('/api/user/heartbeat', { method: 'POST', credentials: 'include' }).catch(() => {});
    };
    ping();
    const hbId = setInterval(ping, 30_000);
    return () => clearInterval(hbId);
  }, []);

  useEffect(() => {
    // Rely on the user prop passed from App.tsx/ProtectedRoute
    if (user) {
      if (user.requiresOnboarding) {
        navigate("/onboarding");
        return;
      }
      setChecked(true);
    }
  }, [user, navigate]);

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
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">Carregando...</div>
    );
  }

  // Gate: email verification required before using dashboard
  if (user.emailVerified === false) {
    return <EmailVerificationGate user={user} onLogout={handleLogout} />;
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
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
            {/* Dynamic breadcrumb */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs text-muted min-w-0" aria-label="Breadcrumb">
              <Link to="/dashboard" className="hover:text-foreground transition-colors shrink-0">Dashboard</Link>
              {location.pathname !== '/dashboard' && (
                <>
                  <span className="text-muted/40">/</span>
                  <span className="text-foreground font-medium truncate">
                    {BREADCRUMB_MAP[location.pathname] ?? (location.pathname.startsWith('/dashboard/lead/') ? 'Detalhes do Lead' : 'Página')}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right side: command palette, credits, theme, notifications, avatar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Command Palette trigger */}
            <CommandPaletteTrigger />

            {/* Credits badge */}
            <Link
              to="/dashboard/planos"
              data-tour="header-credits"
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-violet-600/10 hover:bg-violet-600/20 text-violet-500 transition-colors text-xs font-semibold"
              title={`${user.leadsUsed} de ${user.leadsLimit} créditos usados`}
            >
              <Sparkles size={13} />
              <span className="tabular-nums">{user.leadsLimit - user.leadsUsed}</span>
              <span className="text-violet-600 dark:text-violet-400/70 text-[10px] font-normal">créditos</span>
            </Link>
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
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
                aria-label="Notificações"
                title="Notificações"
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
                  aria-label="Lista de notificações"
                >
                  <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="font-medium text-sm">Notificações</span>
                    {notifPerm !== 'granted' && notifPerm !== 'denied' && (
                      <button
                        type="button"
                        onClick={requestBrowserNotifications}
                        className="text-xs text-violet-500 hover:underline"
                      >
                        Ativar no navegador
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-[120px]">
                    {(() => {
                      if (notifLoading) return <div className="p-4 text-center text-muted text-sm">Carregando...</div>;
                      if (notifItems.length === 0) return <div className="p-4 text-center text-muted text-sm">Nenhuma notificação.</div>;
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
                                {new Date(item.createdAt).toLocaleDateString('pt-BR', {
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
                aria-label="Ver minhas metas"
                title="Minhas metas"
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
                aria-label="Menu da conta"
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
                  aria-label="Menu da conta"
                >
                  <div className="px-3 py-2 border-b border-border">
                    <p className="font-medium text-sm text-foreground truncate">{user.name || 'Usuário'}</p>
                    <p className="text-xs text-muted truncate">{user.email ?? ''}</p>
                  </div>
                  <Link
                    to="/dashboard/perfil"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <User size={16} className="text-muted shrink-0" />
                    Meu perfil
                  </Link>
                  <Link
                    to="/dashboard/configuracoes"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Settings size={16} className="text-muted shrink-0" />
                    Configurações
                  </Link>
                  <Link
                    to="/dashboard/planos"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <CreditCard size={16} className="text-muted shrink-0" />
                    Planos
                  </Link>
                  <Link
                    to="/dashboard/empresa"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Building2 size={16} className="text-muted shrink-0" />
                    Empresa
                  </Link>
                  <Link
                    to="/dashboard/afiliado"
                    role="menuitem"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                    onClick={() => setAvatarDropdownOpen(false)}
                  >
                    <Share2 size={16} className="text-muted shrink-0" />
                    Afiliado
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
                    Sair
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
            <span>Seu plano expira em 3 dias. Regularize seu pagamento para manter o acesso.</span>
            <Link
              to="/dashboard/planos"
              className="underline font-semibold hover:no-underline shrink-0"
            >
              Ver planos
            </Link>
          </div>
        )}

        {/* Notification permission prompt banner */}
        {notifPerm === 'default' && !notifBannerDismissed && (
          <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-violet-600/90 text-white text-xs sm:text-sm font-medium">
            <Bell size={16} className="shrink-0" aria-hidden />
            <span className="truncate sm:whitespace-normal">Ative notificações para receber alertas de leads em tempo real.</span>
            <button
              type="button"
              onClick={requestBrowserNotifications}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors shrink-0"
            >
              Ativar
            </button>
            <button
              type="button"
              onClick={() => { setNotifBannerDismissed(true); localStorage.setItem('notif-banner-dismissed', '1'); }}
              className="p-1 rounded hover:bg-white/20 transition-colors shrink-0"
              aria-label="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <ReleaseNotesBanner />

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
            aria-label="Minhas metas"
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
                  aria-label="Fechar"
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

function EmailVerificationGate({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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
      const msg = err instanceof Error ? err.message : 'Erro ao reenviar';
      if (msg.includes('Aguarde')) {
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
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Gradient top bar */}
          <div className="h-1.5 bg-gradient-to-r from-violet-600 to-indigo-600" />

          <div className="p-8 text-center space-y-6">
            {/* Icon */}
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center shadow-sm">
              <Mail className="w-10 h-10 text-violet-600 dark:text-violet-400" />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Verifique seu e-mail</h2>
              <p className="text-muted text-sm leading-relaxed">
                Enviamos um link de verificação para<br />
                <strong className="text-foreground">{user.email}</strong>
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-surface/50 border border-border rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">1.</span> Abra seu e-mail e procure por uma mensagem de <strong>Precision IA</strong>
              </p>
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">2.</span> Clique no botão <strong>"Confirmar e-mail"</strong> na mensagem
              </p>
              <p className="text-xs text-muted leading-relaxed">
                <span className="font-medium text-foreground">3.</span> Verifique a <strong>caixa de spam</strong> se não encontrar
              </p>
            </div>

            {/* Resend button */}
            <div className="space-y-3">
              {sent && (
                <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg py-2 px-3">
                  <CheckCircle2 size={16} />
                  <span>E-mail reenviado com sucesso!</span>
                </div>
              )}
              {error && !error.includes('Aguarde') && (
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
                  ? 'Enviando...'
                  : cooldown > 0
                    ? `Reenviar em ${cooldown}s`
                    : 'Reenviar e-mail de verificação'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted">ou</span>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-foreground rounded-xl border border-border hover:bg-surface transition-all duration-200"
            >
              <LogOut size={16} />
              Voltar ao login
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted">
          Precision IA &middot; precisionIA.com.br
        </p>
      </div>
    </div>
  );
}
