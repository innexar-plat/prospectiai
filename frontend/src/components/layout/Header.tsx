import React from 'react';
import { createPortal } from 'react-dom';
import { LogIn, Download, Menu, X, Sun, Moon } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { Logo } from '@/components/brand/Logo';
import type { SessionUser } from '@/lib/api';

export type TFunction = (key: string, options?: Record<string, unknown>) => string;

export type HeaderNavProps = {
    locale: string;
    onPlansClick: () => void;
    onCloseMenu?: () => void;
    variant: 'desktop' | 'mobile';
};

function HeaderNavLinks({ locale, onPlansClick, onCloseMenu, variant }: HeaderNavProps) {
    const linkClass = variant === 'desktop'
        ? 'px-3 py-2 rounded-xl text-sm font-semibold text-muted hover:text-foreground hover:bg-surface transition-colors'
        : 'py-3 px-4 rounded-xl font-semibold text-foreground hover:bg-surface transition-colors';
    const Wrapper = 'nav';
    const wrapperClass = variant === 'desktop' ? 'hidden md:flex items-center gap-1 lg:gap-2 ml-5' : 'flex flex-col gap-1';
    return (
        <Wrapper className={wrapperClass} aria-label="Navegação principal">
            {variant === 'mobile' && <span className="text-[10px] font-black tracking-widest text-muted uppercase mb-2">Menu</span>}
            <button type="button" onClick={() => { onPlansClick(); onCloseMenu?.(); }} className={variant === 'desktop' ? linkClass : 'text-left ' + linkClass}>
                {locale === 'pt' ? 'Planos' : 'Plans'}
            </button>
            <Link to="/privacy" onClick={onCloseMenu} className={linkClass}>{locale === 'pt' ? 'Privacidade' : 'Privacy'}</Link>
            <Link to="/terms" onClick={onCloseMenu} className={linkClass}>{locale === 'pt' ? 'Termos' : 'Terms'}</Link>
        </Wrapper>
    );
}

function HeaderDesktopNav({
    locale,
    onPlansClick,
    onLanguageSwitch,
    theme,
    toggleTheme,
    resultsLength,
    isPremiumPlan,
    onExport,
    onPricingRedirect,
    t,
    session,
    onNavigate,
    isMenuOpen,
    onToggleMenu,
}: {
    locale: string;
    onPlansClick: () => void;
    onLanguageSwitch: (lang: string) => void;
    theme: string;
    toggleTheme: () => void;
    resultsLength: number;
    isPremiumPlan: boolean;
    onExport: () => void;
    onPricingRedirect: () => void;
    t: TFunction;
    session: SessionUser | null;
    onNavigate: (path: string) => void;
    isMenuOpen: boolean;
    onToggleMenu: () => void;
}) {
    return (
        <>
            <HeaderNavLinks locale={locale} onPlansClick={onPlansClick} variant="desktop" />
            <div className="flex items-center gap-2 md:gap-3 ml-auto">
                <button type="button" onClick={toggleTheme} className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface transition-colors" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                <div className="hidden sm:flex items-center gap-0.5 p-1 bg-surface rounded-xl border border-border">
                    <button onClick={() => onLanguageSwitch('pt')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${locale === 'pt' ? 'bg-violet-600 text-white shadow-lg' : 'text-muted hover:text-foreground hover:bg-surface'}`}>PT</button>
                    <button onClick={() => onLanguageSwitch('en')} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all ${locale === 'en' ? 'bg-violet-600 text-white shadow-lg' : 'text-muted hover:text-foreground hover:bg-surface'}`}>EN</button>
                </div>
                <div className="flex items-center gap-2">
                    {resultsLength > 0 && (
                        <Button variant={isPremiumPlan ? 'primary' : 'secondary'} size="sm" onClick={() => isPremiumPlan ? onExport() : onPricingRedirect()} icon={isPremiumPlan ? <Download size={14} /> : <span className="text-[10px] grayscale brightness-200">🔒</span>} className="hidden md:flex">
                            {isPremiumPlan ? t('results.export') : 'Export (Pro)'}
                        </Button>
                    )}
                    {!session ? (
                        <Button variant="primary" size="sm" onClick={() => onNavigate('/auth/signin')} icon={<LogIn size={14} />} className="h-10 px-4">Entrar</Button>
                    ) : (
                        <Button variant="secondary" size="sm" onClick={() => onNavigate('/dashboard')} className="h-10 px-4">Dashboard</Button>
                    )}
                    <button className="md:hidden p-2 text-muted hover:text-foreground transition-colors" onClick={onToggleMenu} aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}>
                        {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>
        </>
    );
}

function HeaderMobileNav({
    locale,
    onPlansClick,
    onLanguageSwitch,
    resultsLength,
    isPremiumPlan,
    onExport,
    onPricingRedirect,
    t,
    session,
    onNavigate,
    onCloseMenu,
}: {
    locale: string;
    onPlansClick: () => void;
    onLanguageSwitch: (lang: string) => void;
    resultsLength: number;
    isPremiumPlan: boolean;
    onExport: () => void;
    onPricingRedirect: () => void;
    t: TFunction;
    session: SessionUser | null;
    onNavigate: (path: string) => void;
    onCloseMenu: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[99999] md:hidden" style={{ isolation: 'isolate' }}>
            <div className="absolute inset-0 bg-black/50 touch-manipulation" onClick={onCloseMenu} onTouchEnd={(e) => { e.preventDefault(); onCloseMenu(); }} aria-hidden role="presentation" />
            <div className="absolute left-4 right-4 top-[calc(68px+max(0.25rem,env(safe-area-inset-top))+0.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-200 rounded-3xl shadow-2xl border border-border bg-card backdrop-blur-2xl p-6 flex flex-col gap-6" role="dialog" aria-label="Menu">
                <HeaderNavLinks locale={locale} onPlansClick={onPlansClick} onCloseMenu={onCloseMenu} variant="mobile" />
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black tracking-widest text-muted uppercase">Idioma</span>
                    <div className="flex gap-2">
                        <button onClick={() => { onLanguageSwitch('pt'); onCloseMenu(); }} className={`flex-1 py-3 rounded-xl font-bold text-sm ${locale === 'pt' ? 'bg-violet-600 text-white' : 'bg-surface text-muted'}`}>Português</button>
                        <button onClick={() => { onLanguageSwitch('en'); onCloseMenu(); }} className={`flex-1 py-3 rounded-xl font-bold text-sm ${locale === 'en' ? 'bg-violet-600 text-white' : 'bg-surface text-muted'}`}>English</button>
                    </div>
                </div>
                {resultsLength > 0 && (
                    <Button
                        variant={isPremiumPlan ? 'primary' : 'secondary'}
                        size="lg"
                        onClick={() => {
                            if (isPremiumPlan) onExport();
                            else onPricingRedirect();
                            onCloseMenu();
                        }}
                        icon={isPremiumPlan ? <Download size={20} /> : <span>🔒</span>}
                    >
                        {isPremiumPlan ? t('results.export') : 'Exportar Dados (Pro)'}
                    </Button>
                )}
                {!session && (
                    <Button variant="primary" size="lg" onClick={() => { onNavigate('/auth/signin'); onCloseMenu(); }} icon={<LogIn size={20} />}>Entrar na Plataforma</Button>
                )}
            </div>
        </div>
    );
}

export default function Header({
    session,
    locale,
    onLanguageSwitch,
    resultsLength,
    isPremiumPlan,
    onExport,
    onPricingRedirect,
    t
}: {
    session: SessionUser | null;
    locale: string;
    onLanguageSwitch: (lang: string) => void;
    resultsLength: number;
    isPremiumPlan: boolean;
    onExport: () => void;
    onPricingRedirect: () => void;
    t: TFunction;
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const { theme, toggleTheme } = useTheme();
    const isHome = location.pathname === '/';

    const handlePlansClick = () => {
        if (onPricingRedirect && isHome) {
            onPricingRedirect();
        } else {
            navigate('/');
        }
        setIsMenuOpen(false);
    };

    return (
        <header className="fixed top-0 left-0 right-0 z-50 px-2 sm:px-3 py-1 pointer-events-none overflow-x-hidden" style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))' }}>
            <div className="max-w-7xl mx-auto flex items-center justify-between h-[68px] pointer-events-auto header-wave px-3 md:px-4 rounded-xl shadow-xl border-b border-border/30 min-w-0">

                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center shrink-0 min-w-0 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded-lg"
                    aria-label="ProspectorAI - Ir para início"
                >
                    <Logo iconSize={56} iconSizeMobile={48} iconOnly={false} className="md:gap-2" textClassName="hidden sm:inline text-foreground text-sm md:text-base" />
                </button>

                <div className="flex items-center gap-1 lg:gap-2 ml-5 flex-1 min-w-0">
                    <HeaderDesktopNav
                        locale={locale}
                        onPlansClick={handlePlansClick}
                        onLanguageSwitch={onLanguageSwitch}
                        theme={theme}
                        toggleTheme={toggleTheme}
                        resultsLength={resultsLength}
                        isPremiumPlan={isPremiumPlan}
                        onExport={onExport}
                        onPricingRedirect={onPricingRedirect}
                        t={t}
                        session={session}
                        onNavigate={(path) => navigate(path)}
                        isMenuOpen={isMenuOpen}
                        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
                    />
                </div>
            </div>

            {isMenuOpen && typeof document !== 'undefined' && createPortal(
                <HeaderMobileNav
                    locale={locale}
                    onPlansClick={handlePlansClick}
                    onLanguageSwitch={onLanguageSwitch}
                    resultsLength={resultsLength}
                    isPremiumPlan={isPremiumPlan}
                    onExport={onExport}
                    onPricingRedirect={onPricingRedirect}
                    t={t}
                    session={session}
                    onNavigate={(path) => navigate(path)}
                    onCloseMenu={() => setIsMenuOpen(false)}
                />,
                document.body
            )}
        </header>
    );
}
