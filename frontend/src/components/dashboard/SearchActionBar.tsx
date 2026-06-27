import { Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface SearchActionBarProps {
  onIniciarBusca: () => void;
  loading?: boolean;
  disabled?: boolean;
  estimatedCredits?: number;
  className?: string;
}

export function SearchActionBar({
  onIniciarBusca,
  loading = false,
  disabled = false,
  estimatedCredits = 1,
  className,
}: SearchActionBarProps) {
  const { t } = useI18n();
  const estimate = t('page.search.action.estimate');
  const searchingLabel = t('page.search.action.searching');
  const startLabel = t('page.search.action.start');

  return (
    <div
      className={cn(
        'p-8 rounded-[3rem] bg-gradient-to-r from-violet-600 to-indigo-700 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden shadow-lg border border-violet-500/20',
        className
      )}
    >
      <div
        className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="relative z-10 flex items-center gap-6">
        <div className="w-16 h-16 rounded-[2rem] bg-white/10 backdrop-blur flex items-center justify-center text-white shrink-0">
          <Zap size={32} className="fill-current" aria-hidden />
        </div>
        <div>
          <h3 className="text-2xl font-black text-white mb-1">{t('page.search.action.title')}</h3>
          <p className="text-white/90 font-bold">
            {t('page.search.action.subtitle', { estimate })}
          </p>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">{t('page.search.action.estimatedCost')}</p>
          <p className="text-xl font-black text-white">{t('page.search.action.credits', { count: estimatedCredits })}</p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          className="min-h-[44px] h-14 px-8 text-base bg-white text-violet-600 hover:bg-white/90 border-0 font-black focus:ring-2 focus:ring-white/50"
          icon={loading ? <Loader2 size={20} className="animate-spin" aria-hidden /> : <Zap size={20} aria-hidden />}
          onClick={onIniciarBusca}
          disabled={disabled || loading}
          aria-label={loading ? searchingLabel : t('page.search.action.startAria')}
        >
          {loading ? searchingLabel : startLabel}
        </Button>
      </div>
    </div>
  );
}
