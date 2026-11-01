import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { APP_VERSION, hasSeenWhatsNew, markWhatsNewSeen } from '@/lib/app-version';
import { useI18n } from '@/lib/i18n';
import { isPendingCreditsTour } from '@/lib/post-auth-redirect';
import { wasWelcomeTourDone } from '@/lib/tour-steps';

/**
 * One-line "what's new" strip. Shown once per version: it is marked as seen the first time it
 * renders, so it does not come back on the next visit even if the user never closes it.
 */
export function ReleaseNotesBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => !hasSeenWhatsNew(APP_VERSION));
  const tourPending = isPendingCreditsTour() || !wasWelcomeTourDone();
  const show = visible && !tourPending;

  useEffect(() => {
    if (show) markWhatsNewSeen(APP_VERSION);
  }, [show]);

  const highlights = useMemo(
    () => [t('common.releaseNotes.highlight1'), t('common.releaseNotes.highlight2'), t('common.releaseNotes.highlight3')],
    [t],
  );

  if (!show) return null;

  return (
    <div className="shrink-0 border-b border-[#4F46E5]/15 bg-[#4F46E5]/5">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <Sparkles size={15} className="shrink-0 text-[#4F46E5]" aria-hidden />
        <span className="shrink-0 rounded-full bg-[#4F46E5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          {t('common.releaseNotes.badge', { version: APP_VERSION })}
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-foreground" title={highlights.join(' · ')}>
          {t('common.releaseNotes.title')}
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card hover:text-foreground"
          aria-label={t('common.releaseNotes.closeAria')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
