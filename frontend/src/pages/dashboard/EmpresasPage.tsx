import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Building2, ChevronLeft, ChevronRight, Download, Loader2, Mail, MapPin, MessageCircle, Phone, Search, Sparkles } from 'lucide-react';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { ProfileSearchSuggestions } from '@/components/dashboard/ProfileSearchSuggestions';
import { Button } from '@/components/ui/Button';
import { rfSearchApi, type RfCompanyResult, type SessionUser } from '@/lib/api';
import { BR_STATES } from '@/lib/locationData';
import { exportToCSV } from '@/lib/exportService';
import { cn } from '@/lib/utils';

type Company = RfCompanyResult & { placeId: string };

const PAGE_SIZE = 25;
const PORTES = [
  { value: '', label: 'Todos os portes' },
  { value: 'ME', label: 'Microempresa' },
  { value: 'EPP', label: 'Pequeno porte' },
  { value: 'DEMAIS', label: 'Médio/grande' },
];
const OPENED = [
  { value: 0, label: 'Qualquer data' },
  { value: 30, label: 'Últimos 30 dias' },
  { value: 90, label: 'Últimos 90 dias' },
  { value: 180, label: 'Últimos 6 meses' },
  { value: 365, label: 'Último ano' },
];
const PORTE_LABEL: Record<string, string> = { ME: 'Micro', EPP: 'Pequena', DEMAIS: 'Média/grande' };

function formatOpening(d: string | null): { label: string; recent: boolean } | null {
  if (!d || d.length !== 8) return null;
  const date = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`);
  const days = (Date.now() - date.getTime()) / 86400000;
  return { label: date.toLocaleDateString('pt-BR'), recent: days <= 120 };
}

function formatCnpj(c: string): string {
  return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function whatsappLink(phone: string | null): string | null {
  const digits = phone?.replace(/\D/g, '') ?? '';
  // Mobile numbers (9 digits after the DDD) are the ones likely to have WhatsApp.
  return digits.length === 11 && digits[2] === '9' ? `https://wa.me/55${digits}` : null;
}

/**
 * Volume prospecting over the Receita Federal base (27M active companies): niche → CNAE,
 * city, size, opening date and contact filters. Each new search uses one credit; paging is free.
 */
export default function EmpresasPage() {
  const { user } = useOutletContext<{ user: SessionUser }>();
  const navigate = useNavigate();
  const [niche, setNiche] = useState('');
  const [uf, setUf] = useState(user.state?.trim().toUpperCase().slice(0, 2) || '');
  const [city, setCity] = useState(user.city?.trim() || '');
  const [porte, setPorte] = useState('');
  const [openedWithinDays, setOpenedWithinDays] = useState(0);
  const [hasPhone, setHasPhone] = useState(true);
  const [hasEmail, setHasEmail] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ companies: Company[]; total: number; capped: boolean; cnaes: string[] } | null>(null);

  const canSearch = niche.trim().length >= 3 && !!uf;

  const run = useCallback(async (targetPage: number) => {
    if (!canSearch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await rfSearchApi.search({
        niche: niche.trim(),
        uf,
        municipio: city.trim() || undefined,
        porte: porte || undefined,
        openedWithinDays: openedWithinDays || undefined,
        hasPhone: hasPhone || undefined,
        hasEmail: hasEmail || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setResult({ companies: res.companies, total: res.total, capped: !!res.totalCapped, cnaes: res.cnaesUsed ?? [] });
      setPage(targetPage);
      if (targetPage === 1) window.dispatchEvent(new Event('refresh-user'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível buscar agora.';
      setError(/limit/i.test(message) ? 'Seus créditos deste mês acabaram. Faça upgrade para continuar buscando.' : message);
    } finally {
      setLoading(false);
    }
  }, [canSearch, niche, uf, city, porte, openedWithinDays, hasPhone, hasEmail]);

  useEffect(() => { setPage(1); }, [niche, uf, city, porte, openedWithinDays, hasPhone, hasEmail]);

  const exportPage = () => {
    if (!result?.companies.length) return;
    exportToCSV(result.companies.map((c) => ({
      Empresa: c.nomeFantasia || c.razaoSocial,
      'Razão social': c.razaoSocial,
      CNPJ: formatCnpj(c.cnpj),
      Atividade: c.cnaeDescricao ?? c.cnaePrincipal,
      Porte: PORTE_LABEL[c.porte ?? ''] ?? c.porte ?? '',
      Abertura: formatOpening(c.dataAbertura)?.label ?? '',
      Telefone: c.telefone ?? '',
      'E-mail': c.email ?? '',
      Bairro: c.bairro ?? '',
      Cidade: c.municipio ?? '',
      UF: c.uf,
    })), `empresas-${niche.trim().replace(/\s+/g, '-')}-${city || uf}-p${page}`);
  };

  const totalLabel = result ? `${result.capped ? `${result.total.toLocaleString('pt-BR')}+` : result.total.toLocaleString('pt-BR')} empresas` : '';
  const lastPage = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const field = 'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30';

  return (
    <>
      <HeaderDashboard
        title="Base de Empresas"
        subtitle="27 milhões de empresas ativas da Receita Federal — filtre por nicho, cidade, porte e data de abertura."
        breadcrumb="Prospecção / Base de Empresas"
      />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
        <form
          className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4"
          onSubmit={(e) => { e.preventDefault(); void run(1); }}
          role="search"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden />
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Nicho ou atividade — ex.: distribuidora de salgados, clínica odontológica"
                aria-label="Nicho ou atividade"
                className={cn(field, 'pl-10 h-11')}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="h-11 px-6 shrink-0"
              disabled={!canSearch || loading}
              icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            >
              Buscar empresas
            </Button>
          </div>

          <ProfileSearchSuggestions disabled={loading} onPick={(term) => setNiche(term)} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Estado *</span>
              <select value={uf} onChange={(e) => setUf(e.target.value)} className={field} required>
                <option value="">Selecione</option>
                {BR_STATES.filter((s) => s.value !== 'Todos').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Cidade</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Todas do estado" className={field} />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Porte</span>
              <select value={porte} onChange={(e) => setPorte(e.target.value)} className={field}>
                {PORTES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wide">Aberta em</span>
              <select value={openedWithinDays} onChange={(e) => setOpenedWithinDays(Number(e.target.value))} className={field}>
                {OPENED.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasPhone} onChange={(e) => setHasPhone(e.target.checked)} className="w-4 h-4 accent-violet-600" />
              Só com telefone
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasEmail} onChange={(e) => setHasEmail(e.target.checked)} className="w-4 h-4 accent-violet-600" />
              Só com e-mail
            </label>
            <span className="text-xs text-muted sm:ml-auto">Cada nova busca usa 1 crédito · navegar entre páginas é grátis</span>
          </div>
        </form>

        {error && <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

        {!result && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            <Building2 size={28} className="mx-auto mb-2 opacity-60" aria-hidden />
            <p className="text-sm">Digite o tipo de empresa que você atende e escolha o estado.</p>
            <p className="text-xs mt-1">Dica: filtre por <strong>abertas nos últimos 90 dias</strong> — empresas novas ainda estão escolhendo fornecedores.</p>
          </div>
        )}

        {result && (
          <section aria-live="polite" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{totalLabel}{city ? ` em ${city}` : ` em ${uf}`}</p>
                {result.cnaes.length > 0 && (
                  <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1">
                    <Sparkles size={12} aria-hidden /> Atividades (CNAE) usadas: {result.cnaes.join(', ')}
                  </p>
                )}
              </div>
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportPage} disabled={!result.companies.length}>
                Exportar página (CSV)
              </Button>
            </div>

            {result.companies.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted">
                Nenhuma empresa com esses filtros. Tente ampliar a data de abertura, remover a cidade ou desmarcar “só com e-mail”.
              </div>
            ) : (
              <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden" role="list">
                {result.companies.map((c) => {
                  const opening = formatOpening(c.dataAbertura);
                  const wa = whatsappLink(c.telefone);
                  return (
                    <li key={c.cnpj} className="p-4 hover:bg-surface/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">{c.nomeFantasia || c.razaoSocial}</p>
                            {opening?.recent && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">Nova</span>
                            )}
                            {c.porte && <span className="text-[11px] text-muted">{PORTE_LABEL[c.porte] ?? c.porte}</span>}
                          </div>
                          {c.nomeFantasia && <p className="text-xs text-muted">{c.razaoSocial} · CNPJ {formatCnpj(c.cnpj)}</p>}
                          <p className="text-xs text-muted mt-1">
                            {c.cnaeDescricao ?? c.cnaePrincipal}{opening ? ` · aberta em ${opening.label}` : ''}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 text-muted"><MapPin size={12} aria-hidden />{[c.bairro, c.municipio].filter(Boolean).join(', ')} - {c.uf}</span>
                            {c.telefone && <a href={`tel:${c.telefone.replace(/\D/g, '')}`} className="inline-flex items-center gap-1.5 text-foreground hover:underline tabular-nums"><Phone size={12} aria-hidden />{c.telefone}</a>}
                            {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-foreground hover:underline break-all"><Mail size={12} aria-hidden />{c.email}</a>}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {wa && (
                            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10">
                              <MessageCircle size={14} aria-hidden /> WhatsApp
                            </a>
                          )}
                          <Button size="sm" variant="primary" className="h-9" icon={<Sparkles size={14} />} onClick={() => navigate(`/dashboard/lead/${c.placeId}`)}>
                            Analisar
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {result.companies.length > 0 && (
              <nav className="flex items-center justify-between" aria-label="Paginação">
                <Button variant="secondary" size="sm" icon={<ChevronLeft size={14} />} disabled={page <= 1 || loading} onClick={() => run(page - 1)}>Anterior</Button>
                <span className="text-xs text-muted">Página {page}{result.capped ? '' : ` de ${lastPage}`}</span>
                <Button variant="secondary" size="sm" disabled={loading || result.companies.length < PAGE_SIZE || (!result.capped && page >= lastPage)} onClick={() => run(page + 1)}>
                  Próxima <ChevronRight size={14} className="ml-1" aria-hidden />
                </Button>
              </nav>
            )}
          </section>
        )}
      </div>
    </>
  );
}
