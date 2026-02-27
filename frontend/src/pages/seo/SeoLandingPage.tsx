'use client';

import { useEffect, useRef } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import {
  getSeoEntryBySlug,
  getSeoTitle,
  getSeoDescription,
  getSeoIntro,
  getSeoLocalBlock,
  getSeoFaq,
  getRelatedSeoSlugs,
} from '@/lib/seo-local';

const BASE_URL = 'https://prospectorai.innexar.com.br';

function setMeta(nameOrProperty: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${nameOrProperty}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProperty);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function SeoLandingPage() {
  const pathname = useLocation().pathname;
  const slug = pathname.replace(/^\//, '').replace(/\/$/, '') || null;
  const entry = slug ? getSeoEntryBySlug(slug) : null;
  const defaultTitleRef = useRef(document.title);
  const defaultDescRef = useRef(document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '');

  useEffect(() => {
    if (!entry) return;
    const title = getSeoTitle(entry);
    const description = getSeoDescription(entry);
    const pageUrl = `${BASE_URL}/${entry.slug}`;

    document.title = title;
    setMeta('description', description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);

    setMeta('og:url', pageUrl, true);
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', 'website', true);
    setMeta('og:locale', 'pt_BR', true);
    setMeta('og:image', `${BASE_URL}/og-image.png`, true);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:url', pageUrl);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', `${BASE_URL}/og-image.png`);

    return () => {
      document.title = defaultTitleRef.current;
      setMeta('description', defaultDescRef.current);
      if (canonical) canonical.setAttribute('href', BASE_URL + '/');
      setMeta('og:url', BASE_URL + '/', true);
      setMeta('og:title', 'ProspectorAI — Busca B2B e prospecção com IA', true);
      setMeta('og:description', 'Encontre e analise empresas por nicho e região com IA. Gestão de leads, exportação e trabalho em equipe.', true);
      setMeta('og:image', `${BASE_URL}/og-image.png`, true);
      setMeta('twitter:url', BASE_URL + '/');
      setMeta('twitter:title', 'ProspectorAI — Busca B2B e prospecção com IA');
      setMeta('twitter:description', 'Plataforma B2B para encontrar, analisar e converter empresas com inteligência artificial.');
      setMeta('twitter:image', `${BASE_URL}/og-image.png`);
    };
  }, [entry]);

  if (!entry) return <Navigate to="/" replace />;

  const description = getSeoDescription(entry);
  const h1 =
    entry.type === 'cidade' && entry.city
      ? `Ferramenta de Inteligência Comercial para Empresas em ${entry.city}`
      : entry.type === 'cidade-nicho' && entry.city && entry.niche
        ? `Prospecção B2B para ${entry.niche} em ${entry.city}`
        : entry.type === 'bairro' && entry.neighborhood
          ? `Lista de Empresas por Bairro: ${entry.neighborhood}`
          : 'Geração de Leads B2B e Prospecção com IA';

  const pageUrl = `${BASE_URL}/${entry.slug}`;
  const intro = getSeoIntro(entry);
  const localBlock = getSeoLocalBlock(entry);
  const faq = getSeoFaq(entry);
  const related = getRelatedSeoSlugs(entry);

  const schemaApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication' as const,
    name: 'ProspectorAI',
    url: pageUrl,
    applicationCategory: 'BusinessApplication',
    description: description.slice(0, 200),
    areaServed:
      entry.city || entry.neighborhood
        ? {
            '@type': 'City' as const,
            name: entry.city ?? entry.neighborhood ?? '',
            containedInPlace: entry.region ? { '@type': 'State' as const, name: 'São Paulo' } : undefined,
          }
        : undefined,
  };

  const schemaFaq =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage' as const,
          mainEntity: faq.map((item) => ({
            '@type': 'Question' as const,
            name: item.question,
            acceptedAnswer: { '@type': 'Answer' as const, text: item.answer },
          })),
        }
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaApp) }} />
      {schemaFaq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFaq) }} />
      )}
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-20">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-8 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
        >
          ← Voltar
        </Link>
        <h1 className="text-3xl md:text-4xl font-black mb-4">{h1}</h1>
        <p className="text-muted text-lg mb-6">{description}</p>

        {/* Bloco dinâmico local (único por página — evita doorway) */}
        <section className="prose prose-invert max-w-none space-y-4 text-muted mb-8" aria-labelledby="intro-heading">
          <h2 id="intro-heading" className="sr-only">
            Sobre esta página
          </h2>
          {intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        {localBlock.length > 0 && (
          <section className="prose prose-invert max-w-none space-y-4 text-muted mb-8" aria-labelledby="local-heading">
            <h2 id="local-heading" className="text-xl font-bold text-foreground">
              O que você pode fazer aqui
            </h2>
            {localBlock.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </section>
        )}

        {/* Bloco fixo institucional (metodologia, E-E-A-T) */}
        <section className="prose prose-invert max-w-none space-y-4 text-muted mb-8" aria-labelledby="institucional-heading">
          <h2 id="institucional-heading" className="text-xl font-bold text-foreground">
            Como funciona
          </h2>
          <p>
            A plataforma usa dados estruturados e atualizados: você filtra por nicho e região, vê quantidade de empresas
            por segmento, presença digital (site e telefone) e ranking competitivo. Nos planos Growth e Enterprise, a IA
            sugere script de ligação, e-mail e WhatsApp por lead. Exporte em CSV ou JSON, trabalhe em equipe com
            workspaces e proteja a conta com 2FA.
          </p>
        </section>

        {faq.length > 0 && (
          <section className="mb-10" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="text-xl font-bold text-foreground mb-4">
              Perguntas frequentes
            </h2>
            <ul className="space-y-4 list-none p-0 m-0">
              {faq.map((item, i) => (
                <li key={i} className="border-b border-border pb-4 last:border-0">
                  <h3 className="text-base font-semibold text-foreground mb-2">{item.question}</h3>
                  <p className="text-muted text-sm leading-relaxed">{item.answer}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-4 mb-10">
          <Link
            to="/auth/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold bg-violet-600 text-white hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            Começar grátis
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold border border-border text-foreground hover:bg-muted/50"
          >
            Conhecer a plataforma
          </Link>
        </div>

        {/* Interligação interna (recomendado pelo Google) */}
        {related.length > 0 && (
          <nav className="pt-8 border-t border-border" aria-label="Páginas relacionadas">
            <h2 className="text-sm font-bold text-foreground mb-3">Páginas relacionadas</h2>
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    to={`/${r.slug}`}
                    className="text-sm text-muted hover:text-foreground underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded"
                  >
                    {r.type === 'cidade' && r.city
                      ? `Leads em ${r.city}`
                      : r.type === 'cidade-nicho' && r.city && r.niche
                        ? `${r.niche} em ${r.city}`
                        : r.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
