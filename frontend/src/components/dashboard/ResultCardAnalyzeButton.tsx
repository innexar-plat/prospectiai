import { Loader2, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ResultCardAnalyzeButtonProps {
  score?: number | null;
  isAnalyzing: boolean;
  disabled?: boolean;
  onAnalyze: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ResultCardAnalyzeButton({
  score,
  isAnalyzing,
  disabled,
  onAnalyze,
}: ResultCardAnalyzeButtonProps) {
  const { t } = useI18n();
  const isDone = score != null && !isAnalyzing;

  const baseClass = cn(
    'inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-violet-500/40',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none',
  );

  if (isAnalyzing) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          baseClass,
          'h-9 px-4 bg-gradient-to-r from-violet-600/80 to-purple-600/80 text-white shadow-sm',
        )}
        aria-busy="true"
      >
        <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
        <span>{t('page.resultados.analyzing')}</span>
      </button>
    );
  }

  if (isDone) {
    return (
      <button
        type="button"
        onClick={onAnalyze}
        disabled={disabled}
        className={cn(
          baseClass,
          'h-9 px-3 border border-violet-500/30 bg-violet-500/5 text-violet-700 dark:text-violet-300',
          'hover:bg-violet-500/15 hover:border-violet-500/50 hover:-translate-y-0.5',
        )}
      >
        <Sparkles size={14} className="shrink-0" aria-hidden />
        <span>{t('page.resultados.reanalyze')}</span>
        <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
          {t('page.resultados.badgeAi', { score })}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onAnalyze}
      disabled={disabled}
      className={cn(
        baseClass,
        'h-9 px-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white',
        'shadow-[0_4px_14px_0_rgba(124,58,237,0.25)]',
        'hover:from-violet-500 hover:to-purple-500 hover:shadow-[0_6px_18px_rgba(109,40,217,0.35)] hover:-translate-y-0.5',
        'active:scale-[0.98]',
      )}
    >
      <Sparkles size={14} className="shrink-0" aria-hidden />
      <span>{t('page.resultados.analyzeWithAi')}</span>
    </button>
  );
}
