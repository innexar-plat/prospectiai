import { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
    const id = `toast-${Date.now()}-${crypto.randomUUID()}`;
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

  const value = useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
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
            'rounded-xl border-2 px-4 py-3 shadow-lg backdrop-blur-sm flex items-center justify-between gap-3 min-h-[44px]',
            'text-[#0f172a]',
            t.type === 'error' && 'bg-red-200 dark:bg-red-500/20 border-red-600 dark:border-red-500/40 dark:text-red-200',
            t.type === 'success' && 'bg-emerald-200 dark:bg-emerald-500/20 border-emerald-700 dark:border-emerald-500/40 dark:text-emerald-200',
            t.type === 'warning' && 'bg-amber-200 dark:bg-amber-500/20 border-amber-600 dark:border-amber-500/40 dark:text-amber-200',
            t.type === 'info' && 'bg-violet-200 dark:bg-violet-500/20 border-violet-700 dark:border-violet-500/40 dark:text-violet-200'
          )}
        >
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button
            type="button"
            onClick={() => removeToast(t.id)}
            className="shrink-0 p-1 rounded-lg hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-currentColor opacity-70"
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
