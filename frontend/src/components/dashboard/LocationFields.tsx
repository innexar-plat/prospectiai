import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSearchCountries, getStatesByCountry, countryHasStates, getLocalizedCountryLabel, normalizeCountryCode } from '@/lib/locationData';
import type { StateOption } from '@/lib/locationData';
import { getDefaultSearchCountry } from '@/lib/market';
import { searchApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export interface LocationFieldsValue {
  country: string;
  state: string;
  city: string;
  neighborhood?: string;
}
// eslint-disable-next-line react-refresh/only-export-components
export function createDefaultLocationValue(overrides?: Partial<LocationFieldsValue>): LocationFieldsValue {
  return {
    country: getDefaultSearchCountry(),
    state: 'Todos',
    city: '',
    ...overrides,
  };
}

interface LocationFieldsProps {
  value: LocationFieldsValue;
  onChange: (v: Partial<LocationFieldsValue>) => void;
  disabled?: boolean;
  /** Show neighborhood field (default false) */
  showNeighborhood?: boolean;
  /** Accent color class — default violet */
  accent?: string;
  /** Grid columns class — default "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" */
  gridClass?: string;
}

/**
 * Shared location fields: Country → State → City (with autocomplete) → Neighborhood (optional).
 * Reusable across ConcorrenciaPage, MercadoPage, ViabilidadePage etc.
 */
export function LocationFields({
  value,
  onChange,
  disabled,
  showNeighborhood = false,
  accent = 'violet',
  gridClass = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}: LocationFieldsProps) {
  const { t } = useI18n();
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  const countryCode = normalizeCountryCode(value.country);
  const searchCountries = getSearchCountries();
  const states = getStatesByCountry(countryCode);
  const hasStates = countryHasStates(countryCode);
  const selectedCountry = searchCountries.find((c) => c.value === countryCode);
  const selectedState = states.find((s: StateOption) => s.value === value.state);
  const countryLabel = selectedCountry ? getLocalizedCountryLabel(selectedCountry.value, t) : countryCode;

  const ringClass = `focus:ring-${accent}-500/50`;
  const accentBorder = `border-${accent}-500/40`;

  // Close dropdowns on outside click
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => { if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryOpen]);

  useEffect(() => {
    if (!stateOpen) return;
    const handler = (e: MouseEvent) => { if (stateRef.current && !stateRef.current.contains(e.target as Node)) setStateOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [stateOpen]);

  useEffect(() => {
    if (!cityOpen) return;
    const handler = (e: MouseEvent) => { if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cityOpen]);

  // City autocomplete (BR via IBGE, US via Google Places)
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

    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [value.city, value.state, value.country, disabled]);

  const selectClass =
    'h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground hover:border-violet-500/30 focus:outline-none focus:ring-2 flex items-center justify-between';

  const stateDisplayLabel = selectedState
    ? (value.country === 'BR' && selectedState.value !== 'Todos' ? `${selectedState.label} (${selectedState.value})` : selectedState.label)
    : (value.state || t('location.placeholder.state'));

  const cityPlaceholder = value.country === 'BR' && value.state && value.state !== 'Todos'
    ? t('location.placeholder.cityType3')
    : hasStates && (!value.state || value.state === 'Todos')
      ? t('location.placeholder.selectStateFirst')
      : t('location.placeholder.city');

  return (
    <div className={cn('grid gap-4', gridClass)}>
      {/* Country */}
      <div className="relative" ref={countryRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block flex items-center gap-1">
          <MapPin size={10} className={`text-${accent}-500`} /> {t('location.label.country')}
        </label>
        <button
          type="button"
          onClick={() => !disabled && setCountryOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={countryOpen}
          className={cn(selectClass, ringClass, countryOpen && accentBorder)}
        >
          <span className="truncate flex items-center gap-2">
            {countryLabel}
          </span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted transition-transform', countryOpen && 'rotate-180')} />
        </button>
        {countryOpen && (
          <ul role="listbox" className="absolute z-20 mt-1 w-full rounded-xl bg-card border border-border shadow-lg py-1 max-h-56 overflow-auto">
            {searchCountries.map((c) => (
              <li key={c.value} role="option" aria-selected={value.country === c.value}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm hover:bg-surface focus:outline-none flex items-center gap-2',
                    value.country === c.value && `bg-${accent}-600/10 text-${accent}-500 font-medium`
                  )}
                  onClick={() => {
                    onChange({ country: c.value, state: 'Todos', city: '' });
                    setCountryOpen(false);
                  }}
                >
                  <span>{c.flag}</span> {getLocalizedCountryLabel(c.value, t)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* State */}
      <div className="relative" ref={stateRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">{t('location.label.state')}</label>
        <button
          type="button"
          onClick={() => !disabled && setStateOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={stateOpen}
          className={cn(selectClass, ringClass, stateOpen && accentBorder)}
        >
          <span className="truncate">{stateDisplayLabel}</span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted transition-transform', stateOpen && 'rotate-180')} />
        </button>
        {stateOpen && (
          <ul role="listbox" className="absolute z-20 mt-1 w-full rounded-xl bg-card border border-border shadow-lg py-1 max-h-56 overflow-auto">
            {states.map((s: StateOption) => (
              <li key={s.value} role="option" aria-selected={value.state === s.value}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm hover:bg-surface focus:outline-none',
                    value.state === s.value && `bg-${accent}-600/10 text-${accent}-500 font-medium`
                  )}
                  onClick={() => {
                    onChange({ state: s.value, city: '' });
                    setStateOpen(false);
                  }}
                >
                  {value.country === 'BR' && s.value !== 'Todos' ? `${s.label} (${s.value})` : s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* City with autocomplete */}
      <div className="relative" ref={cityRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">{t('location.label.city')}</label>
        <input
          type="text"
          placeholder={cityPlaceholder}
          value={value.city}
          onChange={(e) => {
            onChange({ city: e.target.value });
            if (!e.target.value.trim()) {
              setCityOpen(false);
              setCitySuggestions([]);
            }
          }}
          disabled={disabled || (value.country === 'BR' && value.state === 'Todos')}
          className={cn(
            'h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 disabled:opacity-50',
            ringClass
          )}
        />
        {cityOpen && citySuggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-30 top-full left-0 right-0 mt-1 w-full rounded-xl border border-border bg-surface shadow-xl py-1 max-h-56 overflow-auto"
          >
            {citySuggestions.map((city) => (
              <li key={city} role="option" aria-selected={value.city === city}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm hover:bg-surface focus:outline-none',
                    value.city === city && `bg-${accent}-600/10 text-${accent}-500 font-medium`
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
          <p className="absolute -bottom-4 left-0 text-[10px] text-muted">{t('location.searchingCities')}</p>
        )}
      </div>

      {showNeighborhood && (
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">{t('location.label.neighborhood')}</label>
          <input
            type="text"
            value={value.neighborhood ?? ''}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            disabled={disabled}
            className={cn(
              'h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 disabled:opacity-50',
              ringClass
            )}
          />
        </div>
      )}
    </div>
  );
}
