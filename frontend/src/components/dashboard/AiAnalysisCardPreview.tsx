import { AlertTriangle, Zap } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  getAiApproachPreview,
  getAiPainPreview,
  type AiAnalysisPreviewSource,
} from '@/lib/analysis-preview';

export function AiAnalysisCardPreview({
  source,
  className,
}: {
  source: AiAnalysisPreviewSource;
  className?: string;
}) {
  const { t } = useI18n();
  const pain = getAiPainPreview(source);
  const approach = getAiApproachPreview(source);

  if (!pain && !approach) return null;

  return (
    <div className={cn('min-w-0 space-y-1 rounded-lg border border-border/50 bg-surface/40 px-2.5 py-2', className)}>
      {pain && (
        <p className="text-[10px] text-muted leading-snug line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
          <span className="inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide text-[9px] text-amber-600 dark:text-amber-400">
            <AlertTriangle size={10} className="shrink-0" aria-hidden />
            {t('page.aiPreview.painLabel')}
          </span>
          <span className="block mt-0.5 text-foreground/80">{pain}</span>
        </p>
      )}
      {approach && (
        <p className={cn('text-[10px] text-muted leading-snug line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]', pain && 'pt-1 border-t border-border/40')}>
          <span className="inline-flex items-center gap-0.5 font-semibold uppercase tracking-wide text-[9px] text-violet-600 dark:text-violet-400">
            <Zap size={10} className="shrink-0" aria-hidden />
            {t('page.aiPreview.approachLabel')}
          </span>
          <span className="block mt-0.5 text-foreground/80">{approach}</span>
        </p>
      )}
    </div>
  );
}
