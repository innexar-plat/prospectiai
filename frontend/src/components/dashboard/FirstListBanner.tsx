import { useEffect, useState } from 'react';
import { Loader2, PartyPopper, X } from 'lucide-react';
import { buildTextQuery, startSearch, type SearchPayload } from '@/lib/searchService';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';
import { cn } from '@/lib/utils';

export const FIRST_SEARCH_SUGGESTIONS_KEY = 'prospector:firstSearchSuggestions';

interface Stored { terms: string[]; city: string; state?: string }

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(FIRST_SEARCH_SUGGESTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) as Stored : null;
    return parsed?.terms?.length && parsed.city ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Shown after onboarding ran the first search automatically: explains what the list is and
 * offers the other niches the AI inferred from the profile, one click each.
 */
export function FirstListBanner({ resultsCount }: { resultsCount: number }) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const { setLastSearchResults } = useSearchResults();
  const [stored, setStored] = useState<Stored | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const s = readStored();
    setStored(s);
    setActive(s?.terms[0] ?? null);
  }, []);

  if (!stored) return null;

  const dismiss = () => {
    try { sessionStorage.removeItem(FIRST_SEARCH_SUGGESTIONS_KEY); } catch { /* optional */ }
    setStored(null);
  };

  const runTerm = async (term: string) => {
    if (loading || term === active) return;
    setLoading(term);
    try {
      const market = getActiveMarket();
      const payload: SearchPayload = { advancedTerm: term, city: stored.city, state: stored.state || undefined, countryCode: market, niches: [] };
      const result = await startSearch(payload, t);
      setLastSearchResults({
        places: result.places ?? [],
        nextPageToken: result.nextPageToken,
        params: { textQuery: buildTextQuery(payload), city: stored.city, state: stored.state || undefined, country: market },
      });
      setActive(term);
      window.dispatchEvent(new Event('refresh-user'));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : t('dash.search.toast.errorGeneric'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <PartyPopper size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {t('page.resultados.firstList.title', { count: resultsCount, term: active ?? '', city: stored.city })}
            </h2>
            <p className="text-sm text-muted mt-1">{t('page.resultados.firstList.body')}</p>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="p-1 rounded-lg text-muted hover:text-foreground" aria-label={t('common.close')}>
          <X size={16} />
        </button>
      </div>
      {stored.terms.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
          <span className="text-xs text-muted">{t('page.resultados.firstList.tryOthers')}</span>
          {stored.terms.map((term) => (
            <button
              key={term}
              type="button"
              disabled={loading != null}
              onClick={() => runTerm(term)}
              aria-pressed={term === active}
              className={cn(
                'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold border transition-colors disabled:opacity-60',
                term === active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-card border-border text-foreground hover:border-emerald-500/40',
              )}
            >
              {loading === term && <Loader2 size={12} className="animate-spin" aria-hidden />}
              {term}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
