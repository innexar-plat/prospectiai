import { useState, useRef, useEffect } from 'react';
import { Sparkles, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

const PRESET_NICHES = ['SaaS', 'Tecnologia', 'Vendas', 'Marketing', 'E-commerce', 'Serviços'] as const;

export interface IntelligenceFormValues {
  niches: string[];
  /** Google Place type (Table A) para filtro de busca */
  includedType?: string;
  advancedTerm: string;
}

interface SearchParamsIntelligenceCardProps {
  value: IntelligenceFormValues;
  onChange: (v: Partial<IntelligenceFormValues>) => void;
  disabled?: boolean;
  /** Validation error for advanced term (e.g. min length). */
  advancedTermError?: string;
}

export function SearchParamsIntelligenceCard({
  value,
  onChange,
  disabled,
  advancedTermError,
}: SearchParamsIntelligenceCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newNiche, setNewNiche] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addOpen) inputRef.current?.focus();
  }, [addOpen]);

  const toggleNiche = (n: string) => {
    if (disabled) return;
    const next = value.niches.includes(n)
      ? value.niches.filter((x) => x !== n)
      : [...value.niches, n];
    onChange({ niches: next });
  };

  const addNiche = () => {
    const trimmed = newNiche.trim();
    if (!trimmed) return;
    const normalized = trimmed.slice(0, 50);
    if (value.niches.includes(normalized)) {
      setNewNiche('');
      setAddOpen(false);
      return;
    }
    onChange({ niches: [...value.niches, normalized] });
    setNewNiche('');
    setAddOpen(false);
  };

  const removeNiche = (n: string) => {
    if (disabled) return;
    onChange({ niches: value.niches.filter((x) => x !== n) });
  };

  return (
    <div className="group p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent hover:from-cyan-500/20 transition-all duration-300 shadow-sm">
      <div className="bg-card p-8 rounded-[2.4rem] h-full space-y-8 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-600/10 flex items-center justify-center text-cyan-400 shrink-0">
              <Sparkles size={24} aria-hidden />
            </div>
            <div>
              <h2 className="font-black text-xl text-foreground">Inteligência</h2>
              <p className="text-xs text-muted font-bold uppercase tracking-widest mt-0.5">Nicho e Termos</p>
            </div>
          </div>
          <button
            type="button"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-foreground transition-colors rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            aria-label="Filtros de inteligência"
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Nicho / Segmento */}
          <div>
            <label id="niche-label" className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block mb-2">
              Nicho / Segmento
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_NICHES.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleNiche(tag)}
                  disabled={disabled}
                  aria-pressed={value.niches.includes(tag)}
                  aria-labelledby="niche-label"
                  className={cn(
                    'min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition-all border focus:outline-none focus:ring-2 focus:ring-violet-500/50',
                    value.niches.includes(tag)
                      ? 'bg-violet-600/10 border-violet-500/20 text-violet-400'
                      : 'bg-surface border-border text-muted hover:text-foreground hover:border-border'
                  )}
                >
                  {tag}
                </button>
              ))}
              {value.niches
                .filter((n) => !PRESET_NICHES.includes(n as typeof PRESET_NICHES[number]))
                .map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold bg-violet-600/10 border border-violet-500/20 text-violet-400"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeNiche(tag)}
                      disabled={disabled}
                      aria-label={`Remover ${tag}`}
                      className="p-0.5 rounded-md hover:bg-violet-500/30 focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-[24px] min-h-[24px] flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              {addOpen ? (
                <span className="inline-flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newNiche}
                    onChange={(e) => setNewNiche(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addNiche();
                      if (e.key === 'Escape') setAddOpen(false);
                    }}
                    placeholder="Novo nicho"
                    className="h-10 w-28 rounded-xl border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    aria-label="Nome do novo nicho"
                  />
                  <button
                    type="button"
                    onClick={addNiche}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-black bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddOpen(false); setNewNiche(''); }}
                    className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-muted hover:bg-surface"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  disabled={disabled}
                  className="min-h-[44px] px-4 py-2 bg-violet-600/10 border border-violet-500/20 rounded-xl text-xs font-black text-violet-400 hover:bg-violet-600/20 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  + Adicionar
                </button>
              )}
            </div>
          </div>

          {/* Termo avançado */}
          <div>
            <label htmlFor="advanced-term" className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 block mb-2">
              Termo de Pesquisa Avançada
            </label>
            <Input
              id="advanced-term"
              placeholder="Ex: Empresas de logística em São Paulo com foco em e-commerce..."
              value={value.advancedTerm}
              onChange={(e) => onChange({ advancedTerm: e.target.value })}
              disabled={disabled}
              className="rounded-2xl text-sm"
              error={advancedTermError}
              aria-invalid={!!advancedTermError}
              aria-describedby={advancedTermError ? 'advanced-term-error' : undefined}
            />
            {advancedTermError && (
              <p id="advanced-term-error" className="mt-1.5 ml-1 text-xs font-medium text-red-400" role="alert">
                {advancedTermError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
