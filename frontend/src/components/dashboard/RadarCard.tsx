import { useCallback, useEffect, useState } from 'react';
import { Briefcase, Check, Loader2, Mail, MessageCircle, Phone, Radar as RadarIcon, Search } from 'lucide-react';
import { crmApi, radarApi, type Radar, type RadarCompany, type RadarItem } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';
import { whatsappLink } from '@/lib/lead-contact-utils';
import { cn } from '@/lib/utils';

const VISIBLE = 4;

/** Brazilian mobile numbers ("(48) 99123-4567") are the only ones worth a WhatsApp button. */
function isMobile(phone: string | null): boolean {
  return !!phone && /\)\s?9\d{4}-\d{4}$/.test(phone);
}

function placeLabel(item: RadarItem): string {
  if (item.city) return `${item.city}${item.state ? `/${item.state}` : ''}`;
  return item.state ?? '';
}

/**
 * Radar de empresas novas: companies that just opened in the niches/places the user searches.
 * Hidden until there is something to show; refreshed by the backend every 12 h.
 */
export function RadarCard({ onSearch }: { onSearch?: (niche: string, city: string | null, state: string | null) => void }) {
  const { addToast } = useToast();
  const [radar, setRadar] = useState<Radar | null>(null);
  const [tab, setTab] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [inCrm, setInCrm] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    radarApi.get().then((r) => { if (!cancelled) setRadar(r); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const addToCrm = useCallback(async (c: RadarCompany, item: RadarItem) => {
    if (busy || inCrm.has(c.cnpj)) return;
    setBusy(c.cnpj);
    try {
      await crmApi.createDeal({
        title: c.name,
        companyName: c.name,
        contactPhone: c.phone ?? undefined,
        contactEmail: c.email ?? undefined,
      });
      setInCrm((prev) => new Set(prev).add(c.cnpj));
      addToast('success', `${c.name} foi para o CRM (${item.niche}).`);
    } catch {
      addToast('error', 'Não foi possível adicionar ao CRM.');
    } finally {
      setBusy(null);
    }
  }, [busy, inCrm, addToast]);

  if (!radar || radar.items.length === 0) return null;
  const item = radar.items[Math.min(tab, radar.items.length - 1)]!;
  const companies = item.companies.slice(0, expanded ? item.companies.length : VISIBLE);
  const total = radar.items.reduce((n, i) => n + i.total, 0);

  return (
    <section id="radar" aria-label="Radar de empresas novas" className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.06] to-transparent px-4 py-3 sm:px-5 stagger-in">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <RadarIcon size={18} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
          Radar: {total >= 300 ? '300+' : total} empresas novas para você
        </h2>
        <p className="text-xs text-muted">
          Abertas {radar.since ? `desde ${radar.since}` : 'recentemente'} nos nichos e cidades que você busca. Ainda estão escolhendo fornecedor.
        </p>
      </header>

      {radar.items.length > 1 && (
        <div role="tablist" aria-label="Nichos do radar" className="mb-2 flex flex-wrap gap-1.5">
          {radar.items.map((i, idx) => (
            <button
              key={`${i.niche}-${i.city}-${i.state}`}
              type="button"
              role="tab"
              aria-selected={idx === tab}
              onClick={() => { setTab(idx); setExpanded(false); }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                idx === tab
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                  : 'border-border bg-surface text-muted hover:text-foreground',
              )}
            >
              {i.niche} · {placeLabel(i)} <span className="opacity-70">({i.total >= 300 ? '300+' : i.total})</span>
            </button>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border">
        {companies.map((c) => {
          const wa = isMobile(c.phone) ? whatsappLink(c.phone, `Olá! Vi que a ${c.name} abriu há pouco tempo e queria me apresentar.`) : null;
          const added = inCrm.has(c.cnpj);
          return (
            <li key={c.cnpj} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted truncate">
                  {[c.bairro, c.openedAt ? `aberta em ${c.openedAt}` : null, c.porte].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {wa ? (
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors">
                    <MessageCircle size={14} aria-hidden /> WhatsApp
                  </a>
                ) : c.phone ? (
                  <a href={`tel:${c.phone.replace(/\D/g, '')}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-surface">
                    <Phone size={13} aria-hidden /> {c.phone}
                  </a>
                ) : null}
                {c.email && (
                  <a href={`mailto:${c.email}`} title={c.email} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface">
                    <Mail size={14} aria-hidden /><span className="sr-only">E-mail {c.email}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { void addToCrm(c, item); }}
                  disabled={busy === c.cnpj || added}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:cursor-default',
                    added ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300' : 'border-violet-500/40 text-violet-700 dark:text-violet-300 hover:bg-violet-600/10',
                  )}
                >
                  {busy === c.cnpj ? <Loader2 size={13} className="animate-spin" aria-hidden /> : added ? <Check size={13} aria-hidden /> : <Briefcase size={13} aria-hidden />}
                  {added ? 'No CRM' : 'CRM'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {item.companies.length > VISIBLE && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline">
            {expanded ? 'Ver menos' : `Ver mais ${item.companies.length - VISIBLE}`}
          </button>
        )}
        {onSearch && (
          <button type="button" onClick={() => onSearch(item.niche, item.city, item.state)} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline">
            <Search size={12} aria-hidden /> Buscar mais {item.niche.toLowerCase()} {item.city ? `em ${item.city}` : ''}
          </button>
        )}
      </div>
    </section>
  );
}
