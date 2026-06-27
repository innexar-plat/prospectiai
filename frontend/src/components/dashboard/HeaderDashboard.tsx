import { Clock, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface HeaderDashboardProps {
  title?: string;
  subtitle?: string;
  breadcrumb?: string;
  onHistórico?: () => void;
  onIniciarBusca?: () => void;
  searchLoading?: boolean;
  primaryDisabled?: boolean;
  className?: string;
  /** Tighter header for results / lead detail pages (~40–50% less height). */
  compact?: boolean;
}

/** Sticky offset for bars below compact HeaderDashboard (matches min-height). */
export const COMPACT_HEADER_STICKY_TOP = '2.75rem';

export function HeaderDashboard({
  title,
  subtitle,
  breadcrumb,
  onHistórico,
  onIniciarBusca,
  searchLoading = false,
  primaryDisabled = false,
  className,
  compact = false,
}: HeaderDashboardProps) {
  const { t } = useI18n();

  const displayTitle = title ?? t('header.defaultTitle');
  const displaySubtitle = subtitle ?? t('header.defaultSubtitle');
  const displayBreadcrumb = breadcrumb ?? t('header.defaultBreadcrumb');

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b backdrop-blur-sm',
        compact
          ? 'min-h-[2.75rem] border-violet-500/10 bg-violet-500/[0.06] px-4 py-1.5 sm:px-5'
          : 'border-border bg-background/95 px-4 py-3 sm:px-6',
        'flex flex-wrap items-center justify-between gap-2',
        className
      )}
      role="banner"
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-semibold uppercase tracking-wider text-muted/80 leading-none',
            compact ? 'text-[9px] mb-0.5' : 'text-[10px]',
          )}
        >
          {displayBreadcrumb}
        </p>
        <div className={cn('flex flex-wrap items-baseline gap-x-2 gap-y-0 min-w-0', compact && 'sm:flex-nowrap')}>
          <h1
            className={cn(
              'font-bold text-foreground tracking-tight min-w-0 break-words [overflow-wrap:anywhere]',
              compact ? 'text-base sm:text-lg leading-tight' : 'text-lg',
            )}
          >
            {displayTitle}
          </h1>
          {displaySubtitle && (
            <p
              className={cn(
                'text-muted min-w-0 break-words [overflow-wrap:anywhere]',
                compact
                  ? 'text-[11px] sm:text-xs sm:shrink-0 before:content-none sm:before:content-["·"] sm:before:mr-2 sm:before:text-muted/50'
                  : 'text-xs mt-0.5 w-full',
              )}
            >
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onHistórico && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-3 text-xs font-semibold"
            icon={<Clock size={14} aria-hidden />}
            onClick={onHistórico}
            aria-label={t('header.historyAria')}
          >
            {t('header.history')}
          </Button>
        )}
        {onIniciarBusca && (
          <Button
            variant="primary"
            size="sm"
            className={cn('h-8 px-4 text-xs font-bold', primaryDisabled && 'opacity-70')}
            icon={
              searchLoading ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Zap size={14} aria-hidden />
              )
            }
            onClick={onIniciarBusca}
            disabled={searchLoading || primaryDisabled}
            aria-label={searchLoading ? t('header.searching') : t('header.startSearchAria')}
          >
            {searchLoading ? t('header.searching') : t('header.startSearch')}
          </Button>
        )}
      </div>
    </header>
  );
}
