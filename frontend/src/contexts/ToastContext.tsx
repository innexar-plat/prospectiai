import { createContext, useCallback, useContext, useState } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastContextValue = {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = DEFAULT_DURATION) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastList />
    </ToastContext.Provider>
  );
}

function ToastList() {
  const { toasts, removeToast } = useContext(ToastContext)!;
  if (!toasts.length) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full safe-area-pb"
      role="region"
      aria-label="Notificações"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={cn(
            'rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm flex items-center justify-between gap-3 min-h-[44px]',
            t.type === 'error' && 'bg-red-100 dark:bg-red-500/20 border-red-400 dark:border-red-500/40 text-red-800 dark:text-red-200',
            t.type === 'success' && 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-200',
            t.type === 'warning' && 'bg-amber-100 dark:bg-amber-500/20 border-amber-500/40 text-amber-800 dark:text-amber-200',
            t.type === 'info' && 'bg-violet-100 dark:bg-violet-500/20 border-violet-500/40 text-violet-800 dark:text-violet-200'
          )}
        >
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="shrink-0 p-1 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
