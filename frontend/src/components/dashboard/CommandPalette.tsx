import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Search, Clock, Target, BarChart3, User, Settings,
  Swords, TrendingUp, Users, LayoutDashboard, CreditCard,
  HelpCircle, Building2, Share2, Command, Plug,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: typeof Search;
  to: string;
  section: string;
}

interface CommandDef {
  id: string;
  labelKey: string;
  shortcut?: string;
  icon: typeof Search;
  to: string;
  sectionKey: string;
}

const COMMAND_DEFS: CommandDef[] = [
  { id: 'nova-busca', labelKey: 'dash.nav.newSearch', shortcut: 'N', icon: Search, to: '/dashboard', sectionKey: 'dash.section.prospection' },
  { id: 'historico', labelKey: 'dash.nav.history', shortcut: 'H', icon: Clock, to: '/dashboard/historico', sectionKey: 'dash.section.prospection' },
  { id: 'leads', labelKey: 'dash.nav.savedLeads', shortcut: 'L', icon: Target, to: '/dashboard/leads', sectionKey: 'dash.section.prospection' },
  { id: 'concorrencia', labelKey: 'dash.nav.competition', icon: Swords, to: '/dashboard/concorrencia', sectionKey: 'dash.section.intelligence' },
  { id: 'relatorios', labelKey: 'dash.nav.reports', icon: BarChart3, to: '/dashboard/relatorios', sectionKey: 'dash.section.intelligence' },
  { id: 'minha-empresa', labelKey: 'dash.nav.myCompany', icon: Building2, to: '/dashboard/minha-empresa', sectionKey: 'dash.section.intelligence' },
  { id: 'viabilidade', labelKey: 'dash.nav.viability', icon: TrendingUp, to: '/dashboard/viabilidade', sectionKey: 'dash.section.intelligence' },
  { id: 'equipe', labelKey: 'dash.nav.myTeam', icon: Users, to: '/dashboard/equipe', sectionKey: 'dash.section.team' },
  { id: 'equipe-dash', labelKey: 'dash.nav.teamDashboard', icon: LayoutDashboard, to: '/dashboard/equipe/dashboard', sectionKey: 'dash.section.team' },
  { id: 'perfil', labelKey: 'dash.nav.profile', icon: User, to: '/dashboard/perfil', sectionKey: 'dash.section.account' },
  { id: 'empresa', labelKey: 'dash.nav.company', icon: Building2, to: '/dashboard/empresa', sectionKey: 'dash.section.account' },
  { id: 'planos', labelKey: 'dash.breadcrumb.plans', icon: CreditCard, to: '/dashboard/planos', sectionKey: 'dash.section.account' },
  { id: 'afiliado', labelKey: 'dash.nav.affiliate', icon: Share2, to: '/dashboard/afiliado', sectionKey: 'dash.section.account' },
  { id: 'integracoes', labelKey: 'dash.nav.integrations', icon: Plug, to: '/dashboard/integracoes', sectionKey: 'dash.section.account' },
  { id: 'config', labelKey: 'dash.menu.settings', icon: Settings, to: '/dashboard/configuracoes', sectionKey: 'dash.section.account' },
  { id: 'suporte', labelKey: 'dash.nav.help', icon: HelpCircle, to: '/dashboard/suporte', sectionKey: 'dash.section.account' },
];

export function CommandPalette() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const COMMANDS: CommandItem[] = useMemo(
    () => COMMAND_DEFS.map((c) => ({ ...c, label: t(c.labelKey), section: t(c.sectionKey) })),
    [t],
  );

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
      (c) => c.label.toLowerCase().includes(q) || c.section.toLowerCase().includes(q),
    );
  }, [query, COMMANDS]);

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
      aria-label={t('dash.command.quickNavLabel')}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t('dash.command.placeholder')}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted/60 outline-none"
            aria-label={t('dash.command.searchShort')}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] text-muted font-mono">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">{t('dash.command.noResults')}</p>
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
                          : 'text-foreground hover:bg-surface',
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

        <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-border text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↑↓</kbd>
            {t('dash.command.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">↵</kbd>
            {t('dash.command.open')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">esc</kbd>
            {t('dash.command.close')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function CommandPaletteTrigger() {
  const { t } = useI18n();
  const handleClick = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-surface/50 hover:bg-surface text-muted hover:text-foreground transition-colors text-xs"
      aria-label={t('dash.command.quickSearch')}
      title={t('dash.command.quickNav')}
    >
      <Command size={13} />
      <span className="text-[11px]">{t('dash.command.searchShort')}</span>
      <kbd className="ml-1 px-1 py-0.5 rounded bg-background border border-border text-[9px] font-mono">⌘K</kbd>
    </button>
  );
}
