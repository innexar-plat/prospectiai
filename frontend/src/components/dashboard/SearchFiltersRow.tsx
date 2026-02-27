import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COUNTRIES, getStatesByCountry } from '@/lib/locationData';
import type { LocationFormValues } from '@/components/dashboard/SearchParamsLocationCard';

const RADIUS_OPTIONS = [5, 10, 20, 30, 50, 100];

interface SearchFiltersRowProps {
  value: LocationFormValues;
  onChange: (v: Partial<LocationFormValues>) => void;
  disabled?: boolean;
}

export function SearchFiltersRow({ value, onChange, disabled }: SearchFiltersRowProps) {
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);

  const states = getStatesByCountry(value.country);
  const selectedCountry = COUNTRIES.find((c) => c.value === value.country);

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

  const selectClass =
    'h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground hover:border-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/30 flex items-center justify-between';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
      <div className="relative" ref={countryRef}>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">País</label>
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
            {COUNTRIES.map((c) => (
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
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">Estado</label>
        <button
          type="button"
          onClick={() => !disabled && setStateOpen((o) => !o)}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={stateOpen}
          className={cn(selectClass, stateOpen && 'border-violet-500/40')}
        >
          <span className="truncate">{value.state}</span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted', stateOpen && 'rotate-180')} />
        </button>
        {stateOpen && (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 w-full rounded-lg bg-card border border-border shadow-lg py-1 max-h-48 overflow-auto"
          >
            {states.map((s) => (
              <li key={s} role="option" aria-selected={value.state === s}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-xs hover:bg-surface focus:outline-none',
                    value.state === s && 'bg-violet-600/10 text-violet-500 font-medium'
                  )}
                  onClick={() => {
                    onChange({ state: s });
                    setStateOpen(false);
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="search-city" className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">Cidade</label>
        <input
          id="search-city"
          type="text"
          placeholder="Opcional"
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">Raio (km)</label>
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
