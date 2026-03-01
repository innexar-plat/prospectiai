import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function StatCard({ value, label, color, suffix, icon: Icon }: { value: string | number; label: string; color: string; suffix?: string; icon?: LucideIcon }) {
    const colors: Record<string, string> = {
        violet: 'text-violet-400',
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        amber: 'text-amber-400',
        rose: 'text-rose-400'
    };
    return (
        <div className="rounded-2xl bg-card border border-border p-5 flex flex-col items-center justify-center text-center gap-1">
            {Icon && <Icon size={20} className={`${colors[color] || 'text-foreground'} mb-1`} />}
            <div className={`text-3xl font-black tabular-nums ${colors[color] || 'text-foreground'}`}>{value}{suffix}</div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider">{label}</div>
        </div>
    );
}

export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
    return (
        <div className="flex items-center justify-center p-12 text-muted gap-3">
            <Loader2 size={24} className="animate-spin" />
            <span>{message}</span>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void
}) {
    return (
        <div className="rounded-[2.4rem] bg-card border border-border p-12 flex flex-col items-center justify-center gap-4 min-h-[320px]">
            <Icon size={48} className="text-muted" aria-hidden />
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <p className="text-sm text-muted text-center max-w-md">{description}</p>
            {actionLabel && onAction && (
                <Button variant="primary" onClick={onAction} className="mt-4">
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}

export function PresenceBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
                <span>{label}</span>
                <span className="tabular-nums font-bold">{count} ({pct}%)</span>
            </div>
            <div className="w-full h-2.5 bg-surface rounded-full overflow-hidden border border-border/50">
                <div className={`h-full rounded-full transition-all duration-700 ease-out ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
