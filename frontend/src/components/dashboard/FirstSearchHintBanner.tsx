import { useCallback, useEffect, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  clearPostOnboardingVisit,
  dismissFirstSearchHint,
  FIRST_SEARCH_HINT_DELAY_MS,
  getFirstSearchExample,
  isFirstSearchHintDismissed,
  isPostOnboardingVisit,
  type FirstSearchExample,
} from '@/lib/first-search-hint';

export interface FirstSearchHintBannerProps {
  isNewUser: boolean;
  trialExpired: boolean;
  searchInProgress: boolean;
  onApplyExample: (example: FirstSearchExample) => void;
}

export function FirstSearchHintBanner({
  isNewUser,
  trialExpired,
  searchInProgress,
  onApplyExample,
}: FirstSearchHintBannerProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const example = getFirstSearchExample();

  const handleDismiss = useCallback(() => {
    dismissFirstSearchHint();
    setVisible(false);
  }, []);

  const handleApply = useCallback(() => {
    onApplyExample(example);
    handleDismiss();
  }, [example, handleDismiss, onApplyExample]);

  useEffect(() => {
    if (!isNewUser || trialExpired || searchInProgress || isFirstSearchHintDismissed()) {
      setVisible(false);
      return;
    }

    if (isPostOnboardingVisit()) {
      clearPostOnboardingVisit();
      setVisible(true);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!isFirstSearchHintDismissed()) {
        setVisible(true);
      }
    }, FIRST_SEARCH_HINT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isNewUser, trialExpired, searchInProgress]);

  useEffect(() => {
    if (searchInProgress && visible) {
      dismissFirstSearchHint();
      setVisible(false);
    }
  }, [searchInProgress, visible]);

  if (!visible) return null;

  const exampleLabel = t(example.exampleLabelKey);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('dash.firstSearchHint.aria')}
      className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <Lightbulb size={16} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          {t('dash.firstSearchHint.prompt')}{' '}
          <button
            type="button"
            onClick={handleApply}
            className="font-semibold text-violet-600 underline decoration-violet-500/40 underline-offset-2 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            {t('dash.firstSearchHint.try', { example: exampleLabel })}
          </button>
        </p>
        <p className="mt-0.5 text-xs text-muted">{t('dash.firstSearchHint.hint')}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-amber-500/10 hover:text-foreground"
        aria-label={t('dash.firstSearchHint.closeAria')}
      >
        <X size={14} />
      </button>
    </div>
  );
}
