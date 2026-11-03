import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Building2, CalendarPlus, MapPin, Phone } from 'lucide-react';
import {
  COMPANY_STATS_BASE_PATH,
  COMPANY_STATS_GENERATED_AT,
  cityHubSlugForPage,
  companyRouteMeta,
  formatCount,
  getCityHub,
  getCityHubLinks,
  getCompanyStatsPage,
  getSegmentHub,
  getSegmentHubLinks,
  relatedCompanyStats,
  type CompanyStatsPage as StatsPage,
  type HubLink,
} from '@/lib/seo-company-stats';
import { HUB_DESCRIPTION, HUB_TITLE, pageFaq } from '@/lib/company-stats-text';
import { saveSeoSearchIntent } from '@/lib/seo-search-intent';
import { getActiveMarket } from '@/lib/market';
import { getAppOrigin } from '@/lib/site-url';

const base = `/${COMPANY_STATS_BASE_PATH}`;

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function useSeoMeta(path: string, title: string, description: string) {
  useEffect(() => {
    const url = `${getAppOrigin()}${path}`;
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
  }, [path, title, description]);
}

function pct(part: number, total: number): string {
  return total ? `${Math.round((part / total) * 100)}%` : '—';
}

function Shell({ children, crumbs }: { children: React.ReactNode; crumbs: Array<{ to?: string; label: string }> }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted">
          <Link to="/" className="hover:text-foreground">Precision</Link>
          {crumbs.map((c) => (
            <span key={c.label}>
              <span className="mx-1.5">/</span>
              {c.to ? <Link to={c.to} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground">{c.label}</span>}
            </span>
          ))}
        </nav>
        {children}
        <p className="mt-10 text-xs text-muted">
          Fonte: dados públicos do CNPJ (Receita Federal), empresas com situação ativa. Atualizado em {new Date(COMPANY_STATS_GENERATED_AT).toLocaleDateString('pt-BR')}.
        </p>
      </main>
    </div>
  );
}

function LinkGrid({ links, suffix }: { links: HubLink[]; suffix?: string }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {links.map((l) => (
        <li key={l.slug}>
          <Link to={`${base}/${l.slug}`} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm hover:border-violet-500/40 hover:bg-violet-500/5">
            <span className="font-medium">{l.label}</span>
            <span className="tabular-nums text-muted">{formatCount(l.total)}{suffix ?? ''}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SignupCta({ page }: { page?: StatsPage }) {
  const href = `/auth/signup?utm_source=seo&utm_medium=organic&utm_campaign=empresas${page ? `&utm_content=${encodeURIComponent(`${page.segment}-${page.uf}`)}` : ''}`;
  const remember = () => {
    if (page) saveSeoSearchIntent({ term: page.segmentName.toLowerCase(), city: page.city, uf: page.uf });
  };
  return (
    <section className="mt-8 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
      <h2 className="text-lg font-bold">{page ? 'Quer a lista completa, com telefone e e-mail?' : 'Encontre seus próximos clientes'}</h2>
      <p className="mt-1 text-sm text-muted">
        {page
          ? `Na Precision você filtra ${page.segmentName.toLowerCase()} de ${page.city} por bairro, porte e data de abertura, vê os contatos e recebe uma análise de cada empresa feita por IA, com sugestão de abordagem.`
          : 'Na Precision você busca empresas por segmento e cidade, vê telefone e e-mail e recebe uma análise de cada uma feita por IA, com sugestão de abordagem.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {page && (
          <Link
            to={`/amostra?segmento=${encodeURIComponent(page.segment)}&cidade=${encodeURIComponent(page.city)}&uf=${page.uf}`}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Receber 20 empresas desta lista grátis <ArrowRight size={16} aria-hidden />
          </Link>
        )}
        <Link to={href} onClick={remember} className={page ? 'inline-flex items-center gap-2 rounded-xl border border-violet-500/40 px-5 py-2.5 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10' : 'inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700'}>
          {page ? 'Ver a lista completa — 7 dias grátis' : 'Testar grátis por 7 dias'} {!page && <ArrowRight size={16} aria-hidden />}
        </Link>
      </div>
      <p className="mt-2 text-xs text-muted">Sem cartão de crédito.</p>
    </section>
  );
}

function SegmentCityView({ slug, page }: { slug: string; page: StatsPage }) {
  const faq = pageFaq(page);
  const related = relatedCompanyStats(slug);
  const seg = page.segmentName.toLowerCase();
  const smallShare = pct(page.porte.ME + page.porte.EPP, page.total);
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${page.segmentName} em ${page.city} (${page.uf})`,
      description: companyRouteMeta(slug)?.description,
      creator: { '@type': 'Organization', name: 'Precision IA', url: getAppOrigin() },
      isBasedOn: 'Cadastro Nacional da Pessoa Jurídica (Receita Federal) — dados públicos',
      dateModified: COMPANY_STATS_GENERATED_AT,
      spatialCoverage: { '@type': 'Place', name: `${page.city}, ${page.uf}, Brasil` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];
  return (
    <Shell crumbs={[{ to: base, label: 'Empresas' }, { to: `${base}/${cityHubSlugForPage(page)}`, label: page.city }, { label: page.segmentName }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <h1 className="text-3xl md:text-4xl font-black leading-tight">Lista de {page.segmentName} em {page.city} ({page.uf})</h1>
      <p className="mt-3 text-lg text-muted">
        Existem <strong className="text-foreground">{formatCount(page.total)} empresas ativas</strong> de {seg} em {page.city}, segundo a base pública da Receita Federal.
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

      <SignupCta page={page} />

      {page.topBairros.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">Bairros com mais {seg} em {page.city}</h2>
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
        <h2 className="text-xl font-bold text-foreground">Como vender para {seg} em {page.city}</h2>
        <p>
          Comece pelas {formatCount(page.openedLast12m)} empresas abertas no último ano: ainda estão escolhendo fornecedores e costumam responder mais.
          Depois, priorize os bairros com maior concentração para otimizar visitas e entregas.
        </p>
        <p>
          Com {smallShare} de micro e pequenas empresas, a decisão costuma estar com o próprio dono — uma mensagem direta, curta e com um benefício concreto funciona melhor que uma apresentação longa.
          Cerca de {page.withPhonePct}% têm telefone cadastrado e {page.withEmailPct}% têm e-mail, então combine WhatsApp, ligação e e-mail.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Perguntas frequentes</h2>
        <dl className="mt-4 space-y-4">
          {faq.map((f) => (
            <div key={f.q}>
              <dt className="text-sm font-semibold">{f.q}</dt>
              <dd className="mt-1 text-sm text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-base font-bold">Veja também</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`${base}/${r.slug}`} className="inline-block rounded-full border border-border px-3 py-1 text-xs hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-300">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

/**
 * Public "Empresas" pages with real counts from the Receita base — the pages a seller lands on
 * when searching for a list of companies. Static HTML for crawlers is generated at build.
 */
export default function CompanyStatsPage() {
  const { slug = '' } = useParams<{ slug?: string }>();
  const page = slug ? getCompanyStatsPage(slug) : null;
  const city = slug && !page ? getCityHub(slug) : null;
  const segment = slug && !page && !city ? getSegmentHub(slug) : null;
  const meta = slug ? companyRouteMeta(slug) : { title: HUB_TITLE, description: HUB_DESCRIPTION };
  useSeoMeta(slug ? `${base}/${slug}` : base, meta?.title ?? HUB_TITLE, meta?.description ?? HUB_DESCRIPTION);

  if (getActiveMarket() === 'US') return <Navigate to="/" replace />;
  if (page) return <SegmentCityView slug={slug} page={page} />;

  if (city) {
    return (
      <Shell crumbs={[{ to: base, label: 'Empresas' }, { label: city.city }]}>
        <h1 className="text-3xl md:text-4xl font-black leading-tight">Empresas em {city.city} ({city.uf}) por segmento</h1>
        <p className="mt-3 text-lg text-muted">
          {formatCount(city.total)} empresas ativas em {city.links.length} segmentos, segundo a base pública da Receita Federal. Escolha o segmento para ver bairros, porte e empresas recém-abertas.
        </p>
        <LinkGrid links={city.links} suffix=" empresas" />
        <SignupCta />
      </Shell>
    );
  }

  if (segment) {
    return (
      <Shell crumbs={[{ to: base, label: 'Empresas' }, { label: segment.segmentName }]}>
        <h1 className="text-3xl md:text-4xl font-black leading-tight">Lista de {segment.segmentName} por cidade</h1>
        <p className="mt-3 text-lg text-muted">
          {formatCount(segment.total)} empresas ativas em {segment.links.length} cidades, segundo a base pública da Receita Federal.
        </p>
        <LinkGrid links={segment.links} />
        <SignupCta />
      </Shell>
    );
  }

  if (slug) return <Navigate to={base} replace />;

  return (
    <Shell crumbs={[{ label: 'Empresas' }]}>
      <h1 className="text-3xl md:text-4xl font-black leading-tight">Listas de empresas por cidade e segmento</h1>
      <p className="mt-3 text-lg text-muted">
        Quantas empresas existem em cada cidade e segmento do Brasil, com dados públicos da Receita Federal. Use para planejar sua prospecção e encontrar clientes para vender.
      </p>
      <section className="mt-8">
        <h2 className="text-xl font-bold">Por cidade</h2>
        <LinkGrid links={getCityHubLinks()} suffix=" empresas" />
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-bold">Por segmento</h2>
        <LinkGrid links={getSegmentHubLinks()} suffix=" empresas" />
      </section>
      <SignupCta />
    </Shell>
  );
}
