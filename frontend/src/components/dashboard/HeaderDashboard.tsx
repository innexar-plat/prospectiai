import { Clock, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface HeaderDashboardProps {
  title?: string;
  subtitle?: string;
  breadcrumb?: string;
  onHistórico?: () => void;
  onIniciarBusca?: () => void;
  searchLoading?: boolean;
  primaryDisabled?: boolean;
  className?: string;
}

export function HeaderDashboard({
  title = 'Parâmetros de Busca',
  subtitle = 'Configure seu público-alvo e nossa IA fará o resto.',
  breadcrumb = 'Prospecção Ativa / Nova Busca',
  onHistórico,
  onIniciarBusca,
  searchLoading = false,
  primaryDisabled = false,
  className,
}: HeaderDashboardProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm',
        'px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3',
        className
      )}
      role="banner"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted" aria-hidden>
          {breadcrumb}
        </p>
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onHistórico && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 px-3 text-xs font-semibold"
            icon={<Clock size={14} aria-hidden />}
            onClick={onHistórico}
            aria-label="Ver histórico de buscas"
          >
            Histórico
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
            aria-label={searchLoading ? 'Buscando...' : 'Iniciar busca'}
          >
            {searchLoading ? 'Buscando...' : 'Iniciar Busca'}
          </Button>
        )}
      </div>
    </header>
  );
}
