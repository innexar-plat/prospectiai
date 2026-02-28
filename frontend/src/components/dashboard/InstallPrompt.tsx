import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSTip, setShowIOSTip] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed (defer setState to avoid sync setState in effect)
        if (localStorage.getItem('pwa-install-dismissed')) {
            queueMicrotask(() => setDismissed(true));
            return;
        }

        // Detect iOS (iPad on macOS 13+ reports as Mac with touch; avoid deprecated navigator.platform)
        const ua = navigator.userAgent;
        const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        queueMicrotask(() => setIsIOS(isIOSDevice && !isStandalone));

        // Listen for install prompt (Chrome/Edge/Android)
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        }
    };

    const handleDismiss = () => {
        setDismissed(true);
        localStorage.setItem('pwa-install-dismissed', '1');
    };

    // Already installed or dismissed
    if (dismissed || (!deferredPrompt && !isIOS)) return null;

    // iOS — show tip
    if (isIOS && !deferredPrompt) {
        if (!showIOSTip) {
            return (
                <button
                    type="button"
                    onClick={() => setShowIOSTip(true)}
                    className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                    title="Instalar App"
                >
                    <Download size={16} />
                </button>
            );
        }

        return (
            <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card border border-border rounded-2xl p-4 shadow-xl z-50">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-sm font-bold text-foreground">Instalar ProspectorAI</h3>
                    <button type="button" onClick={handleDismiss} className="text-muted hover:text-foreground"><X size={16} /></button>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                    Toque em <strong className="text-foreground">Compartilhar</strong> (ícone ⬆️) e depois em <strong className="text-foreground">"Adicionar à Tela de Início"</strong>.
                </p>
            </div>
        );
    }

    // Chrome/Edge/Android — install button
    return (
        <button
            type="button"
            onClick={handleInstall}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
            title="Instalar App"
        >
            <Download size={16} />
        </button>
    );
}
