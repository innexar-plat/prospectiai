import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search, Clock, Target, BarChart3, User, Settings,
  Swords, TrendingUp, Users, LayoutDashboard, CreditCard,
  HelpCircle, Building2, Share2, Command, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: typeof Search;
  to: string;
  section: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'nova-busca', label: 'Nova Busca', shortcut: 'N', icon: Search, to: '/dashboard', section: 'Prospecção' },
  { id: 'historico', label: 'Histórico', shortcut: 'H', icon: Clock, to: '/dashboard/historico', section: 'Prospecção' },
  { id: 'leads', label: 'Leads Salvos', shortcut: 'L', icon: Target, to: '/dashboard/leads', section: 'Prospecção' },
  { id: 'concorrencia', label: 'Concorrência', icon: Swords, to: '/dashboard/concorrencia', section: 'Inteligência' },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart3, to: '/dashboard/relatorios', section: 'Inteligência' },
  { id: 'minha-empresa', label: 'Análise minha empresa', icon: Building2, to: '/dashboard/minha-empresa', section: 'Inteligência' },
  { id: 'viabilidade', label: 'Viabilidade', icon: TrendingUp, to: '/dashboard/viabilidade', section: 'Inteligência' },
  { id: 'equipe', label: 'Minha Equipe', icon: Users, to: '/dashboard/equipe', section: 'Equipe' },
  { id: 'equipe-dash', label: 'Dashboard da equipe', icon: LayoutDashboard, to: '/dashboard/equipe/dashboard', section: 'Equipe' },
  { id: 'perfil', label: 'Perfil', icon: User, to: '/dashboard/perfil', section: 'Conta' },
  { id: 'empresa', label: 'Empresa', icon: Building2, to: '/dashboard/empresa', section: 'Conta' },
  { id: 'planos', label: 'Planos', icon: CreditCard, to: '/dashboard/planos', section: 'Conta' },
  { id: 'afiliado', label: 'Afiliado', icon: Share2, to: '/dashboard/afiliado', section: 'Conta' },
  { id: 'integracoes', label: 'Integrações', icon: Plug, to: '/dashboard/integracoes', section: 'Conta' },
  { id: 'config', label: 'Configurações', icon: Settings, to: '/dashboard/configuracoes', section: 'Conta' },
  { id: 'suporte', label: 'Suporte', icon: HelpCircle, to: '/dashboard/suporte', section: 'Conta' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q)
    );
  }, [query]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.section) ?? [];
      arr.push(item);
      map.set(item.section, arr);
    }
    return map;
  }, [filtered]);

  const flatItems = filtered;

  const handleSelect = (item: CommandItem) => {
    setOpen(false);
    navigate(item.to);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatItems[selectedIndex]);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Navegação rápida"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Buscar página ou ação..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none"
            aria-label="Buscar"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] text-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">Nenhum resultado encontrado.</p>
          ) : (
            Array.from(grouped.entries()).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                  {section}
                </p>
                {items.map((item) => {
                  const idx = flatItems.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                        idx === selectedIndex
                          ? 'bg-violet-600/10 text-violet-500'
                          : 'text-foreground hover:bg-surface'
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] text-muted font-mono">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↑↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↵</kbd>
            abrir
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">esc</kbd>
            fechar
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Small button to trigger the command palette */
export function CommandPaletteTrigger() {
  const handleClick = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface/50 hover:bg-surface text-muted hover:text-foreground transition-colors text-xs"
      aria-label="Busca rápida (Ctrl+K)"
      title="Navegação rápida (Ctrl+K)"
    >
      <Command size={13} />
      <span className="text-[11px]">Buscar...</span>
      <kbd className="ml-1 px-1 py-0.5 rounded bg-background border border-border text-[9px] font-mono">⌘K</kbd>
    </button>
  );
}
