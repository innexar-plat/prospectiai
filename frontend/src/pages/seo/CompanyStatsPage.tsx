import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Building2, CalendarPlus, MapPin, Phone } from 'lucide-react';
import {
  COMPANY_STATS_BASE_PATH,
  COMPANY_STATS_GENERATED_AT,
  companyStatsDescription,
  companyStatsTitle,
  formatCount,
  getCompanyStatsPage,
  relatedCompanyStats,
} from '@/lib/seo-company-stats';
import { getActiveMarket } from '@/lib/market';
import { getAppOrigin } from '@/lib/site-url';

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : '—';
}

/**
 * "Empresas de <segmento> em <cidade>": real counts from the Receita base, the page a seller lands
 * on when searching for a list of companies. The static HTML for crawlers is generated at build.
 */
export default function CompanyStatsPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const page = getCompanyStatsPage(slug);

  useEffect(() => {
    if (!page) return;
    const url = `${getAppOrigin()}/${COMPANY_STATS_BASE_PATH}/${slug}`;
    const title = companyStatsTitle(page);
    const description = companyStatsDescription(page);
    const previousTitle = document.title;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
    return () => { document.title = previousTitle; };
  }, [page, slug]);

  if (getActiveMarket() === 'US' || !page) return <Navigate to="/" replace />;

  const related = relatedCompanyStats(slug);
  const signupHref = `/auth/signup?utm_source=seo&utm_medium=organic&utm_campaign=empresas&utm_content=${encodeURIComponent(slug)}`;
  const segmentLower = page.segmentName.toLowerCase();
  const smallShare = pct(page.porte.ME + page.porte.EPP, page.total);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${page.segmentName} em ${page.city} (${page.uf})`,
    description: companyStatsDescription(page),
    creator: { '@type': 'Organization', name: 'Precision IA', url: getAppOrigin() },
    isBasedOn: 'Cadastro Nacional da Pessoa Jurídica (Receita Federal) — dados públicos',
    dateModified: COMPANY_STATS_GENERATED_AT,
    spatialCoverage: { '@type': 'Place', name: `${page.city}, ${page.uf}, Brasil` },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
          <Link to="/" className="hover:text-foreground">Precision</Link>
          <span className="mx-1.5">/</span>
          <span>Empresas</span>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{page.segmentName} em {page.city}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-black leading-tight">
          {page.segmentName} em {page.city} ({page.uf})
        </h1>
        <p className="mt-3 text-lg text-muted">
          Existem <strong className="text-foreground">{formatCount(page.total)} empresas ativas</strong> de {segmentLower} em {page.city}, segundo a base pública da Receita Federal.
          {' '}{formatCount(page.openedLast12m)} delas abriram nos últimos 12 meses.
        </p>

        <section aria-label="Números" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Building2, label: 'Empresas ativas', value: formatCount(page.total) },
            { icon: CalendarPlus, label: 'Abertas em 12 meses', value: formatCount(page.openedLast12m) },
            { icon: Phone, label: 'Com telefone', value: `${page.withPhonePct}%` },
            { icon: MapPin, label: 'Micro e pequenas', value: smallShare },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <Icon size={16} className="text-violet-600 dark:text-violet-400" aria-hidden />
              <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
          <h2 className="text-lg font-bold">Quer a lista completa, com telefone e e-mail?</h2>
          <p className="mt-1 text-sm text-muted">
            Na Precision você filtra {segmentLower} de {page.city} por bairro, porte e data de abertura, vê os contatos e recebe uma análise de cada empresa feita por IA, com sugestão de abordagem.
          </p>
          <Link to={signupHref} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
            Ver lista grátis por 7 dias <ArrowRight size={16} aria-hidden />
          </Link>
          <p className="mt-2 text-xs text-muted">Sem cartão de crédito.</p>
        </section>

        {page.topBairros.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">Bairros com mais {segmentLower} em {page.city}</h2>
            <ol className="mt-4 space-y-2">
              {page.topBairros.map((b, i) => (
                <li key={b.name} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right tabular-nums text-muted">{i + 1}.</span>
                  <span className="flex-1">{b.name}</span>
                  <span className="tabular-nums font-semibold">{formatCount(b.count)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-bold">Porte das empresas</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-3 text-sm">
            <li className="rounded-xl border border-border p-3"><strong>{formatCount(page.porte.ME)}</strong> microempresas (ME)</li>
            <li className="rounded-xl border border-border p-3"><strong>{formatCount(page.porte.EPP)}</strong> pequenas (EPP)</li>
            <li className="rounded-xl border border-border p-3"><strong>{formatCount(page.porte.DEMAIS)}</strong> médias e grandes</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3 text-sm leading-relaxed text-muted">
          <h2 className="text-xl font-bold text-foreground">Como vender para {segmentLower} em {page.city}</h2>
          <p>
            Comece pelas {formatCount(page.openedLast12m)} empresas abertas no último ano: ainda estão escolhendo fornecedores e costumam responder mais.
            Depois, priorize os bairros com maior concentração para otimizar visitas e entregas.
          </p>
          <p>
            Com {smallShare} de micro e pequenas empresas, a decisão costuma estar com o próprio dono — uma mensagem direta, curta e com um benefício concreto funciona melhor que uma apresentação longa.
            Cerca de {page.withPhonePct}% têm telefone cadastrado e {page.withEmailPct}% têm e-mail, então combine WhatsApp, ligação e e-mail.
          </p>
        </section>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-bold">Veja também</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link to={`/${COMPANY_STATS_BASE_PATH}/${r.slug}`} className="inline-block rounded-full border border-border px-3 py-1 text-xs hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-300">
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-xs text-muted">
          Fonte: dados públicos do CNPJ (Receita Federal), empresas com situação ativa. Atualizado em {new Date(COMPANY_STATS_GENERATED_AT).toLocaleDateString('pt-BR')}.
        </p>
      </main>
    </div>
  );
}
