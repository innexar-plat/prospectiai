import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Floating banner rendered via portal so it escapes header overflow/backdrop-blur containment (iOS Safari). */
function FloatingBanner({ children }: { children: React.ReactNode }) {
    return createPortal(children, document.body);
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('pwa-install-dismissed')) {
            queueMicrotask(() => setDismissed(true));
            return;
        }

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            queueMicrotask(() => setDismissed(true));
            return;
        }

        // Detect iOS
        const ua = navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
        if (isIOSDevice) queueMicrotask(() => setIsIOS(true));

        // Listen for install prompt (Chrome/Edge/Android)
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);

        // Show banner after 5 seconds if not dismissed
        const timer = setTimeout(() => setShowBanner(true), 5000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            clearTimeout(timer);
        };
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                setDeferredPrompt(null);
                setDismissed(true);
            }
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('pwa-install-dismissed', '1');
    };

    // Already installed or dismissed
    if (dismissed || (!deferredPrompt && !isIOS)) return null;

    // Header icon (always visible when not dismissed)
    const headerIcon = (
        <button
            type="button"
            onClick={deferredPrompt ? handleInstall : () => setShowBanner(true)}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="Instalar App"
            aria-label="Instalar aplicativo"
        >
            <Download size={16} />
        </button>
    );

    // iOS floating banner (via portal)
    if (isIOS && showBanner) {
        return (
            <>
                {headerIcon}
                <FloatingBanner>
                    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card border border-border rounded-2xl p-4 shadow-xl z-[200]">
                        <div className="flex gap-3 items-start">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                                <Smartphone size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-sm font-bold text-foreground">Instalar PrecisionAI</h3>
                                    <button type="button" onClick={handleDismiss} className="text-muted hover:text-foreground -mt-1 -mr-1 p-1" aria-label="Fechar">
                                        <X size={14} />
                                    </button>
                                </div>
                                <p className="text-xs text-muted leading-relaxed mt-1">
                                    Toque em <strong className="text-foreground">Compartilhar</strong> (⬆️) e depois em <strong className="text-foreground">"Adicionar à Tela de Início"</strong>.
                                </p>
                            </div>
                        </div>
                    </div>
                </FloatingBanner>
            </>
        );
    }

    // Chrome/Edge/Android — floating banner (via portal)
    if (deferredPrompt && showBanner) {
        return (
            <>
                {headerIcon}
                <FloatingBanner>
                    <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card border border-border rounded-2xl p-4 shadow-xl z-[200]">
                        <div className="flex gap-3 items-start">
                            <div className="shrink-0 w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                                <Download size={20} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-sm font-bold text-foreground">Instalar PrecisionAI</h3>
                                    <button type="button" onClick={handleDismiss} className="text-muted hover:text-foreground -mt-1 -mr-1 p-1" aria-label="Fechar">
                                        <X size={14} />
                                    </button>
                                </div>
                                <p className="text-xs text-muted leading-relaxed mt-1 mb-2">
                                    Acesse mais rápido direto da sua tela inicial.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleInstall}
                                    className="w-full py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
                                >
                                    Instalar agora
                                </button>
                            </div>
                        </div>
                    </div>
                </FloatingBanner>
            </>
        );
    }

    // Only show the header icon before banner appears
    return headerIcon;
}
