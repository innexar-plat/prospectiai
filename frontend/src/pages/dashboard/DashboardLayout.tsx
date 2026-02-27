import { Outlet, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Bell, BellOff, Target, X, AlertTriangle, Menu, User, Settings, CreditCard, LogOut, ChevronDown } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { InstallPrompt } from "@/components/dashboard/InstallPrompt";
import { TeamProgressCard } from "@/components/dashboard/TeamProgressCard";
import { DashboardTourTrigger } from "@/components/dashboard/DashboardTourTrigger";
import { authApi, notificationsApi, type SessionUser, type NotificationItem } from '@/lib/api';
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { SearchResultsProvider } from "@/contexts/SearchResultsContext";

export function DashboardLayout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const { theme, toggleTheme } = useTheme();
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

  const requestBrowserNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

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
    // Clear storage to prevent stale states
    localStorage.removeItem('prospector-session');
    sessionStorage.clear();
    window.location.replace("/auth/signin");
  };

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted">Carregando...</div>
    );
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
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
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
            <div className="relative" ref={notifDropdownRef}>
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
                    {notifLoading ? (
                      <div className="p-4 text-center text-muted text-sm">Carregando...</div>
                    ) : notifItems.length === 0 ? (
                      <div className="p-4 text-center text-muted text-sm">Nenhuma notificação.</div>
                    ) : (
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
                    )}
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
            <div className="relative ml-1" ref={avatarDropdownRef}>
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
                    className="w-7 h-7 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center font-semibold text-[10px] text-violet-400">
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
                </div>
              )}
            </div>
          </div>
        </header>

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

        {/* Main Content */}
        <main className={cn("flex-1 flex flex-col overflow-y-auto relative min-w-0 text-foreground")} role="main">
          <div className="absolute top-0 right-0 w-[600px] h-[300px] bg-violet-600/5 blur-[120px] rounded-full pointer-events-none" aria-hidden />
          <DashboardTourTrigger />
          <SearchResultsProvider>
            <div className="flex-1 min-h-0">
              <Outlet context={{ user }} />
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
