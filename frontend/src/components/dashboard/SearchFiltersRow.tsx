import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSearchCountries, getStatesByCountry } from '@/lib/locationData';
import type { StateOption } from '@/lib/locationData';
import { searchApi } from '@/lib/api';
import type { LocationFormValues } from '@/components/dashboard/SearchParamsLocationCard';
import { useI18n } from '@/lib/i18n';

const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

interface SearchFiltersRowProps {
  value: LocationFormValues;
  onChange: (v: Partial<LocationFormValues>) => void;
  disabled?: boolean;
}

export function SearchFiltersRow({ value, onChange, disabled }: SearchFiltersRowProps) {
  const { t } = useI18n();
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  const searchCountries = getSearchCountries();
  const states = getStatesByCountry(value.country);
  const selectedCountry = searchCountries.find((c) => c.value === value.country);
  const selectedState = states.find((s: StateOption) => s.value === value.state);

  useEffect(() => {
    if (!countryOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [countryOpen]);

  useEffect(() => {
    if (!stateOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (stateRef.current && !stateRef.current.contains(e.target as Node)) setStateOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [stateOpen]);

  useEffect(() => {
    if (!cityOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [cityOpen]);

  useEffect(() => {
    const country = value.country;
    const state = value.state;
    const q = value.city.trim();
    if (disabled || !['BR', 'US'].includes(country) || !state || state === 'Todos' || q.length < (country === 'US' ? 2 : 3)) {
      setCitySuggestions([]);
      setCityOpen(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setCityLoading(true);
      searchApi
        .citySuggestions({ state, country, q })
        .then((res) => {
          if (cancelled) return;
          setCitySuggestions(res.cities ?? []);
          setCityOpen((res.cities?.length ?? 0) > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setCitySuggestions([]);
          setCityOpen(false);
        })
        .finally(() => {
          if (!cancelled) setCityLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value.city, value.state, value.country, disabled]);

  const selectClass =
    'h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 flex items-center justify-between';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
      <div className="relative" ref={countryRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('page.search.filters.country')}</label>
        <button
          type="button"
          onClick={() => !disabled && setCountryOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={countryOpen}
          className={cn(selectClass, countryOpen && 'border-violet-500/40 ring-2 ring-violet-500/20')}
        >
          <span className="truncate">{selectedCountry?.label ?? value.country}</span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted', countryOpen && 'rotate-180')} />
        </button>
        {countryOpen && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1 max-h-48 overflow-auto"
          >
            {searchCountries.map((c) => (
              <li key={c.value} role="option" aria-selected={value.country === c.value}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs hover:bg-surface focus:outline-none',
                    value.country === c.value && 'bg-violet-600/10 text-violet-500 font-medium'
                  )}
                  onClick={() => {
                    onChange({ country: c.value, state: 'Todos' });
                    setCountryOpen(false);
                  }}
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative" ref={stateRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('page.search.filters.state')}</label>
        <button
          type="button"
          onClick={() => !disabled && setStateOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={stateOpen}
          className={cn(selectClass, stateOpen && 'border-violet-500/40')}
        >
          <span className="truncate">{selectedState ? (value.country === 'BR' && value.state !== 'Todos' ? `${selectedState.label} (${selectedState.value})` : selectedState.label) : value.state}</span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted', stateOpen && 'rotate-180')} />
        </button>
        {stateOpen && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1 max-h-48 overflow-auto"
          >
            {states.map((s: StateOption) => (
              <li key={s.value} role="option" aria-selected={value.state === s.value}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs hover:bg-surface focus:outline-none',
                    value.state === s.value && 'bg-violet-600/10 text-violet-500 font-medium'
                  )}
                  onClick={() => {
                    onChange({ state: s.value });
                    setStateOpen(false);
                  }}
                >
                  {s.value !== 'Todos' && value.country === 'BR' ? `${s.label} (${s.value})` : s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative" ref={cityRef}>
        <label htmlFor="search-city" className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('page.search.filters.city')}</label>
        <input
          id="search-city"
          type="text"
          placeholder={value.state && value.state !== 'Todos' ? t('page.search.filters.cityPlaceholder') : t('page.search.filters.cityPlaceholderNoState')}
          value={value.city}
          onChange={(e) => {
            onChange({ city: e.target.value });
            if (!e.target.value.trim()) {
              setCityOpen(false);
              setCitySuggestions([]);
            }
          }}
          disabled={disabled || value.state === 'Todos'}
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
        />
        {cityOpen && citySuggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1 max-h-56 overflow-auto"
          >
            {citySuggestions.map((city) => (
              <li key={city} role="option" aria-selected={value.city === city}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs hover:bg-surface focus:outline-none',
                    value.city === city && 'bg-violet-600/10 text-violet-500 font-medium'
                  )}
                  onClick={() => {
                    onChange({ city });
                    setCityOpen(false);
                  }}
                >
                  {city}
                </button>
              </li>
            ))}
          </ul>
        )}
        {cityLoading && (
          <p className="absolute -bottom-4 left-0 text-[10px] text-muted">{t('page.search.filters.cityLoading')}</p>
        )}
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('page.search.filters.radius')}</label>
        <div className="flex gap-1 flex-wrap">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => !disabled && onChange({ radiusKm: r })}
              disabled={disabled}
              aria-pressed={value.radiusKm === r}
              className={cn(
                'h-9 px-2.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                value.radiusKm === r
                  ? 'bg-violet-600 text-white'
                  : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
