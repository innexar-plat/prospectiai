import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Building2 } from 'lucide-react';
import { cnaeApi, type CnaeCode } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getActiveMarket } from '@/lib/market';

interface CnaeAutocompleteProps {
  /** Selected CNAE codes (multi-select) */
  values: string[];
  /** Called when selection changes — returns array of codes + combined description */
  onChange: (codes: string[], description?: string) => void;
  disabled?: boolean;
}

interface SelectedCnae {
  code: string;
  description: string;
}

export function CnaeAutocomplete({ values, onChange, disabled }: CnaeAutocompleteProps) {
  const { t } = useI18n();
  const isUsMarket = getActiveMarket() === 'US';
  const basePlaceholder = isUsMarket ? t('page.search.cnae.placeholderUs') : t('page.search.cnae.placeholder');
  const addPlaceholder = isUsMarket ? t('page.search.cnae.placeholderUs') : t('page.search.cnae.placeholderAdd');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<CnaeCode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedCnae[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Sync external values → internal selected (e.g. when quick template sets cnaes)
  useEffect(() => {
    if (values.length === 0 && selected.length > 0) {
      setSelected([]);
    }
  }, [values, selected.length]);

  // Fetch suggestions
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      cnaeApi.search(q, 15)
        .then((res) => {
          if (cancelled) return;
          // Filter out already-selected codes
          const filtered = (res.codes ?? []).filter((c) => !values.includes(c.code));
          setSuggestions(filtered);
          setOpen(filtered.length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setSuggestions([]);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);

    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [query, values]);

  const selectCode = useCallback((code: CnaeCode) => {
    const newSelected = [...selected, { code: code.code, description: code.description }];
    setSelected(newSelected);
    const codes = newSelected.map((s) => s.code);
    onChange(codes, newSelected.map((s) => s.description).join(', '));
    setQuery('');
    setOpen(false);
  }, [selected, onChange]);

  const removeCode = useCallback((code: string) => {
    const newSelected = selected.filter((s) => s.code !== code);
    setSelected(newSelected);
    const codes = newSelected.map((s) => s.code);
    onChange(codes.length > 0 ? codes : [], newSelected.length > 0 ? newSelected.map((s) => s.description).join(', ') : undefined);
  }, [selected, onChange]);

  const clearAll = useCallback(() => {
    setSelected([]);
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onChange([], undefined);
  }, [onChange]);

  return (
    <div ref={ref} className="relative w-full">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((s) => (
            <span key={s.code} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-violet-500/40 bg-violet-600/10 text-xs text-foreground">
              <Building2 size={12} className="text-violet-500 shrink-0" />
              <span className="font-mono text-violet-600 dark:text-violet-400 text-[10px]">{formatCnae(s.code)}</span>
              <span className="truncate max-w-[200px]">{s.description}</span>
              <button
                type="button"
                onClick={() => removeCode(s.code)}
                disabled={disabled}
                className="shrink-0 text-muted hover:text-foreground transition-colors p-0.5 rounded"
                aria-label={t('page.search.cnae.remove', { description: s.description })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={disabled}
              className="text-[10px] text-muted hover:text-foreground transition-colors px-1.5 py-1"
            >
              {t('page.search.cnae.clearAll')}
            </button>
          )}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={selected.length > 0 ? addPlaceholder : basePlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          aria-label={t('page.search.cnae.searchAria')}
          aria-autocomplete="list"
          role="combobox"
          aria-expanded={open}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted">...</span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full rounded-lg bg-card border border-border shadow-xl py-1 max-h-56 overflow-auto"
        >
          {suggestions.map((code) => (
            <li key={code.code} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-violet-600/10 focus:outline-none transition-colors"
                onClick={() => selectCode(code)}
              >
                <span className="font-mono font-bold text-violet-600 dark:text-violet-400">{formatCnae(code.code)}</span>
                <span className="ml-2 text-foreground">{code.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Format CNAE code: 7020400 → 70.20-4-00 */
function formatCnae(code: string): string {
  if (code.length !== 7) return code;
  return `${code.slice(0, 2)}.${code.slice(2, 4)}-${code.slice(4, 5)}-${code.slice(5, 7)}`;
}
