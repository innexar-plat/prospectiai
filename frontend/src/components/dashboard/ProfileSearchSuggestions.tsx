import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { onboardingApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';

const CACHE_KEY = 'prospector:profileSuggestions';

/**
 * "Para você": niches inferred from the seller profile (what they sell / who buys it), so users
 * do not have to guess a Google Maps category. One click fills the search.
 */
export function ProfileSearchSuggestions({ onPick, disabled }: { onPick: (term: string) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [terms, setTerms] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? '[]') as string[]; } catch { return []; }
  });

  useEffect(() => {
    if (terms.length > 0) return;
    let cancelled = false;
    onboardingApi.suggestSearches({ locale: getActiveMarket() === 'US' ? 'en' : 'pt' })
      .then(({ terms: found }) => {
        if (cancelled || !found.length) return;
        setTerms(found);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(found)); } catch { /* optional */ }
      })
      .catch(() => { /* suggestions are optional */ });
    return () => { cancelled = true; };
  }, [terms.length]);

  if (terms.length === 0) return null;

  return (
    <section aria-label={t('dash.search.forYou')} className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Sparkles size={13} className="text-violet-500" aria-hidden /> {t('dash.search.forYou')}
      </span>
      {terms.map((term) => (
        <button
          key={term}
          type="button"
          disabled={disabled}
          onClick={() => onPick(term)}
          className="h-7 px-3 rounded-full text-xs font-medium border border-violet-500/25 bg-violet-500/5 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors disabled:opacity-50"
        >
          {term}
        </button>
      ))}
    </section>
  );
}
