import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Sparkles, X } from 'lucide-react';
import type { SessionUser } from '@/lib/api';
import { getProfileCompleteness } from '@/lib/profile-completeness';
import { useI18n } from '@/lib/i18n';

const DISMISS_KEY = 'profile-completeness-banner-dismissed-at';
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function ProfileCompletenessBanner({
  user,
  onPrimaryAction,
}: {
  user: SessionUser;
  onPrimaryAction: () => void;
}) {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const { percent, isCompleteEnough, missingKeys } = useMemo(() => getProfileCompleteness(user), [user]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) return;
      const timestamp = Number(raw);
      if (!Number.isFinite(timestamp)) return;
      if (Date.now() - timestamp < DISMISS_TTL_MS) {
        setDismissed(true);
      }
    } catch {
      // Ignore storage issues.
    }
  }, []);

  if (dismissed || isCompleteEnough) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage issues.
    }
  };

  const missingLabels = missingKeys.map((key) => t(key));
  const missingItems = `${missingLabels.slice(0, 3).join(', ')}${missingKeys.length > 3 ? ` ${t('common.profile.banner.missingMore')}` : '.'}`;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-violet-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(245,243,255,0.96))] p-5 sm:p-6 shadow-[0_20px_60px_rgba(139,92,246,0.12)]">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-violet-400/15 blur-3xl" aria-hidden />
      <div className="absolute bottom-0 right-24 h-16 w-16 rounded-full bg-cyan-400/10 blur-2xl" aria-hidden />
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white/70 text-muted transition-colors hover:text-foreground"
        aria-label={t('common.profile.banner.closeAria')}
      >
        <X size={14} />
      </button>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700">
            <Sparkles size={12} /> {t('common.profile.banner.badge')}
          </div>
          <h3 className="mt-3 text-lg font-black text-foreground sm:text-xl">
            {t('common.profile.banner.title')}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {t('common.profile.banner.desc')}
          </p>
          <p className="mt-2 text-xs text-muted">
            {t('common.profile.banner.missing', { items: missingItems })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="w-full min-w-[180px] sm:w-52">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted">
              <span>{t('common.profile.banner.completeness')}</span>
              <span>{percent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-violet-500/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 transition-all duration-700"
                style={{ width: `${Math.max(12, percent)}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center rounded-xl border border-border bg-white/70 px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              {t('common.profile.banner.later')}
            </button>
            <button
              type="button"
              onClick={onPrimaryAction}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-transform hover:-translate-y-0.5"
            >
              {t('common.profile.banner.complete')}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
