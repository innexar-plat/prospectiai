import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

/** Content wrapper — matches ResultadosPage / LeadDetail width and padding. */
export const INTELLIGENCE_CONTENT_CLASS =
  'p-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-5 min-w-0 box-border';

/** Responsive stat-card grid used across intelligence modules. */
export const INTELLIGENCE_STAT_GRID_CLASS =
  'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4';

export function IntelligenceSectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card px-4 py-3 sm:p-4 min-w-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IntelligenceFormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card px-4 py-4 sm:p-5 min-w-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IntelligenceErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed break-words [overflow-wrap:anywhere]">
          {message}
        </p>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="shrink-0 self-start sm:self-center"
          icon={<RefreshCw size={14} aria-hidden />}
          onClick={onRetry}
        >
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function IntelligenceLoadingSkeleton({ statCount = 4 }: { statCount?: number }) {
  return (
    <div className="space-y-5 min-w-0" aria-busy="true" aria-label="Loading">
      <div className={INTELLIGENCE_STAT_GRID_CLASS}>
        {Array.from({ length: statCount }, (_, i) => (
          <div
            key={`stat-skel-${i}`}
            className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2"
          >
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

export type AiInsightChip = {
  label: string;
  tone?: 'violet' | 'blue' | 'emerald' | 'amber' | 'rose';
};

const CHIP_TONES: Record<NonNullable<AiInsightChip['tone']>, string> = {
  violet: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

export type AiInsightTab = {
  key: string;
  label: string;
  icon?: LucideIcon;
  items: string[];
  bulletClass?: string;
};

export function AiInsightsPanel({
  title,
  summary,
  summaryLabel,
  chips = [],
  tabs,
}: {
  title: string;
  summary: string;
  summaryLabel?: string;
  chips?: AiInsightChip[];
  tabs: AiInsightTab[];
}) {
  const nonEmptyTabs = tabs.filter((tab) => tab.items.length > 0);
  const [activeTab, setActiveTab] = useState(nonEmptyTabs[0]?.key ?? '');

  if (!summary && nonEmptyTabs.length === 0) return null;

  const active = nonEmptyTabs.find((tab) => tab.key === activeTab) ?? nonEmptyTabs[0];

  return (
    <IntelligenceSectionCard className="space-y-4 border-violet-500/20 bg-violet-500/5">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
        <Lightbulb size={14} className="text-violet-600 dark:text-violet-400 shrink-0" aria-hidden />
        {title}
      </h3>

      {(chips.length > 0 || summary) && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2.5 sm:p-4 space-y-2.5 min-w-0">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip.label}
                  className={cn(
                    'inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border',
                    CHIP_TONES[chip.tone ?? 'violet'],
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
          {summary && (
            <div className="min-w-0">
              {summaryLabel && (
                <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-1">
                  {summaryLabel}
                </p>
              )}
              <p className="text-sm text-foreground leading-relaxed break-words [overflow-wrap:anywhere]">
                {summary}
              </p>
            </div>
          )}
        </div>
      )}

      {nonEmptyTabs.length > 0 && (
        <>
          <div className="flex gap-1 p-0.5 rounded-lg bg-surface border border-border w-fit flex-wrap">
            {nonEmptyTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-colors',
                    active?.key === tab.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-muted hover:text-foreground hover:bg-violet-500/10',
                  )}
                >
                  {Icon && <Icon size={12} aria-hidden />}
                  {tab.label}
                  <span className="opacity-70 tabular-nums">({tab.items.length})</span>
                </button>
              );
            })}
          </div>
          {active && (
            <div className="bg-surface/60 p-3 rounded-lg border border-border/30 min-w-0">
              <ul className="space-y-2">
                {active.items.map((item) => (
                  <li
                    key={`${active.key}-${String(item).slice(0, 80)}`}
                    className="text-sm text-muted leading-relaxed flex gap-2 break-words [overflow-wrap:anywhere]"
                  >
                    <span
                      className={cn('shrink-0 mt-1', active.bulletClass ?? 'text-violet-600 dark:text-violet-400')}
                      aria-hidden
                    >
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </IntelligenceSectionCard>
  );
}
