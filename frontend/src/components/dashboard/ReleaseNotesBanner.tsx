import { useMemo, useState } from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import {
  APP_VERSION,
  hasSeenWhatsNew,
  markWhatsNewSeen,
} from '@/lib/app-version';
import { useI18n } from '@/lib/i18n';
import { isPendingCreditsTour } from '@/lib/post-auth-redirect';
import { wasWelcomeTourDone } from '@/lib/tour-steps';

const BRAND = '#1047da';

export function ReleaseNotesBanner() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(() => hasSeenWhatsNew(APP_VERSION));
  const tourPending = isPendingCreditsTour() || !wasWelcomeTourDone();

  const highlights = useMemo(
    () => [
      t('common.releaseNotes.highlight1'),
      t('common.releaseNotes.highlight2'),
      t('common.releaseNotes.highlight3'),
    ],
    [t],
  );

  if (dismissed || tourPending) return null;

  const handleDismiss = () => {
    markWhatsNewSeen(APP_VERSION);
    setDismissed(true);
  };

  return (
    <div
      className="shrink-0 border-b border-[#1047da]/15 bg-gradient-to-r from-[#1047da]/10 via-[#1047da]/5 to-transparent"
      style={{ borderBottomColor: `${BRAND}26` }}
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:px-6">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1"
          style={{ backgroundColor: `${BRAND}1a`, color: BRAND, borderColor: `${BRAND}33` }}
        >
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white"
              style={{ backgroundColor: BRAND, borderColor: `${BRAND}66` }}
            >
              {t('common.releaseNotes.badge', { version: APP_VERSION })}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {t('common.releaseNotes.title')}
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: BRAND }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card/80 text-muted transition-colors hover:border-[#1047da]/25 hover:text-foreground"
          aria-label={t('common.releaseNotes.closeAria')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
