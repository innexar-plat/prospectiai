import { useState, useRef, useEffect } from 'react';
import { MapPin, Settings, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSearchCountries, getStatesByCountry } from '@/lib/locationData';
import { Input } from '@/components/ui/Input';
import { useI18n } from '@/lib/i18n';

export interface LocationFormValues {
  country: string;
  state: string;
  city: string;
  radiusKm: number;
}

interface SearchParamsLocationCardProps {
  value: LocationFormValues;
  onChange: (v: Partial<LocationFormValues>) => void;
  disabled?: boolean;
}

const RADIUS_STEP = 5;
const RADIUS_MIN = 5;
const RADIUS_MAX = 100;

export function SearchParamsLocationCard({ value, onChange, disabled }: SearchParamsLocationCardProps) {
  const { t } = useI18n();
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<HTMLDivElement>(null);

  const searchCountries = getSearchCountries();
  const states = getStatesByCountry(value.country);
  const selectedCountry = searchCountries.find((c) => c.value === value.country);

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

  return (
    <div className="group p-1 rounded-[2.5rem] bg-gradient-to-br from-foreground/10 to-transparent hover:from-violet-500/20 transition-all duration-300 shadow-sm">
      <div className="bg-card p-8 rounded-[2.4rem] h-full space-y-8 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/10 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <MapPin size={24} aria-hidden />
            </div>
            <div>
              <h2 className="font-black text-xl text-foreground">{t('page.search.location.title')}</h2>
              <p className="text-xs text-muted font-bold uppercase tracking-widest mt-0.5">{t('page.search.location.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-foreground transition-colors rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            aria-label={t('page.search.location.settingsAria')}
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* País */}
          <div className="relative" ref={countryRef}>
            <label className="sr-only">{t('page.search.location.countrySr')}</label>
            <button
              type="button"
              onClick={() => !disabled && setCountryOpen((o) => !o)}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={countryOpen}
              aria-label={t('page.search.location.selectCountry')}
              className={cn(
                'w-full p-5 rounded-3xl bg-surface border border-border hover:border-violet-500/30 transition-all flex items-center justify-between min-h-[44px] text-left',
                countryOpen && 'border-violet-500/40 ring-2 ring-violet-500/20'
              )}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl" aria-hidden>{selectedCountry?.flag ?? '🌐'}</span>
                <div>
                  <p className="text-xs font-black text-muted uppercase tracking-widest">{t('page.search.location.countrySelected')}</p>
                  <p className="font-bold text-foreground">{selectedCountry?.label ?? value.country}</p>
                </div>
              </div>
              <ChevronRight size={18} className={cn('text-muted transition-transform', countryOpen && 'rotate-90')} />
            </button>
            {countryOpen && (
              <ul
                role="listbox"
                className="absolute z-10 mt-1 w-full rounded-2xl bg-card border border-border shadow-xl py-2 max-h-60 overflow-auto"
              >
                {searchCountries.map((c) => (
                  <li key={c.value} role="option" aria-selected={value.country === c.value}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-surface focus:bg-surface focus:outline-none min-h-[44px]',
                        value.country === c.value && 'bg-violet-600/10 text-violet-600 dark:text-violet-400'
                      )}
                      onClick={() => {
                        onChange({ country: c.value, state: 'Todos' });
                        setCountryOpen(false);
                      }}
                    >
                      <span aria-hidden>{c.flag}</span>
                      {c.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Estado e Cidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative" ref={stateRef}>
              <label id="location-state-label" className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">{t('page.search.location.state')}</label>
              <button
                type="button"
                id="location-state"
                onClick={() => !disabled && setStateOpen((o) => !o)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={stateOpen}
                aria-labelledby="location-state-label"
                className={cn(
                  'w-full p-5 rounded-3xl bg-surface border border-border hover:border-violet-500/30 transition-all flex items-center justify-between min-h-[44px] text-left',
                  stateOpen && 'border-violet-500/40'
                )}
              >
                <span className="font-bold text-muted italic">{states.find((s) => s.value === value.state)?.label ?? value.state}</span>
                <ChevronRight size={16} className={cn('text-muted transition-transform', stateOpen && 'rotate-90')} />
              </button>
              {stateOpen && (
                <ul
                  role="listbox"
                  className="absolute z-10 mt-1 w-full rounded-2xl bg-card border border-border shadow-xl py-2 max-h-60 overflow-auto"
                >
                  {states.map((s) => (
                    <li key={s.value} role="option" aria-selected={value.state === s.value}>
                      <button
                        type="button"
                        className={cn(
                          'w-full px-5 py-3 text-left hover:bg-surface focus:outline-none min-h-[44px]',
                          value.state === s.value && 'bg-violet-600/10 text-violet-600 dark:text-violet-400 font-bold'
                        )}
                        onClick={() => {
                          onChange({ state: s.value });
                          setStateOpen(false);
                        }}
                      >
                        {value.country === 'BR' ? `${s.label} (${s.value})` : s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="location-city" className="text-xs font-black text-muted uppercase tracking-widest mb-1 block">{t('page.search.location.cityOptional')}</label>
              <Input
                id="location-city"
                placeholder={t('page.search.location.cityPlaceholder')}
                value={value.city}
                onChange={(e) => onChange({ city: e.target.value })}
                disabled={disabled}
                className="rounded-3xl h-12"
                aria-describedby="location-city-desc"
              />
              <span id="location-city-desc" className="sr-only">{t('page.search.location.cityDesc')}</span>
            </div>
          </div>

          {/* Raio */}
          <div className="p-5 rounded-3xl bg-surface border border-border">
            <div className="flex justify-between items-center mb-4">
              <label id="radius-label" className="text-xs font-black text-muted uppercase tracking-widest">{t('page.search.location.radius')}</label>
              <span className="text-violet-600 dark:text-violet-400 font-black text-sm">{value.radiusKm} km</span>
            </div>
            <input
              type="range"
              min={RADIUS_MIN}
              max={RADIUS_MAX}
              step={RADIUS_STEP}
              value={value.radiusKm}
              onChange={(e) => onChange({ radiusKm: Number(e.target.value) })}
              disabled={disabled}
              aria-labelledby="radius-label"
              aria-valuemin={RADIUS_MIN}
              aria-valuemax={RADIUS_MAX}
              aria-valuenow={value.radiusKm}
              className="w-full h-2 bg-surface rounded-full appearance-none accent-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-card"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
