import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { IntelligenceFormValues } from '@/components/dashboard/SearchParamsIntelligenceCard';
import { PLACE_TYPE_CATEGORIES, getPlaceTypeByValue } from '@/lib/placeTypes';

interface SearchSegmentRowProps {
  value: IntelligenceFormValues;
  onChange: (v: Partial<IntelligenceFormValues>) => void;
  disabled?: boolean;
  advancedTermError?: string;
}

export function SearchSegmentRow({
  value,
  onChange,
  disabled,
  advancedTermError,
}: SearchSegmentRowProps) {
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number>(-1);

  const categoryIndexFromType = value.includedType
    ? PLACE_TYPE_CATEGORIES.findIndex((c) =>
      c.types.some((t) => t.value === value.includedType)
    )
    : -1;
  const effectiveCategoryIndex = categoryIndexFromType >= 0 ? categoryIndexFromType : selectedCategoryIndex;
  const currentTypes = effectiveCategoryIndex >= 0 ? PLACE_TYPE_CATEGORIES[effectiveCategoryIndex].types : [];
  const selectedTypeLabel = value.includedType
    ? getPlaceTypeByValue(value.includedType)?.label
    : null;

  const handleCategoryChange = (index: number) => {
    setSelectedCategoryIndex(index);
    onChange({ includedType: undefined });
  };

  const handleTypeChange = (typeValue: string) => {
    onChange({ includedType: typeValue || undefined });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <div className="lg:col-span-4 space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Categoria</label>
        <select
          value={effectiveCategoryIndex >= 0 ? effectiveCategoryIndex : ''}
          onChange={(e) => {
            const v = e.target.value;
            handleCategoryChange(v === '' ? -1 : Number(v));
          }}
          disabled={disabled}
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          aria-label="Categoria do estabelecimento"
        >
          <option value="">Selecione uma categoria</option>
          {PLACE_TYPE_CATEGORIES.map((cat, idx) => (
            <option key={cat.label} value={idx}>
              {cat.label}
            </option>
          ))}
        </select>

        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted block">Tipo / Segmento</label>
        <select
          value={value.includedType ?? ''}
          onChange={(e) => handleTypeChange(e.target.value)}
          disabled={disabled || effectiveCategoryIndex < 0}
          className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
          aria-label="Tipo de estabelecimento (Google Places)"
        >
          <option value="">Selecione um tipo</option>
          {currentTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {selectedTypeLabel && (
          <p className="text-[10px] text-muted">Filtro ativo: {selectedTypeLabel}</p>
        )}
      </div>

      <div className="lg:col-span-8">
        <label htmlFor="advanced-term-row" className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5 block">Termo avançado</label>
        <input
          id="advanced-term-row"
          type="text"
          placeholder="Ex: Empresas de logística em São Paulo..."
          value={value.advancedTerm}
          onChange={(e) => onChange({ advancedTerm: e.target.value })}
          disabled={disabled}
          aria-invalid={!!advancedTermError}
          className={cn(
            'h-9 w-full rounded-lg border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50',
            advancedTermError ? 'border-red-500/50' : 'border-border'
          )}
        />
        {advancedTermError && (
          <p className="mt-1 text-[10px] text-red-500" role="alert">{advancedTermError}</p>
        )}
      </div>
    </div>
  );
}
