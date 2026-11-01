/**
 * Public "Empresas" SEO pages: aggregate numbers from the Receita base
 * (scripts/seo-company-stats.py writes src/data/seo-company-stats.json). Never contacts.
 *
 *   /empresas                         → hub (cities and segments)
 *   /empresas/em-<cidade>-<uf>        → every segment in one city
 *   /empresas/<segmento>              → one segment in every city
 *   /empresas/<segmento>-em-<cidade>-<uf> → one segment in one city
 *
 * scripts/generate-seo-html.mjs reads the same JSON for the static HTML and the sitemap.
 */
import data from '@/data/seo-company-stats.json';
import {
  cityHubDescription,
  cityHubTitle,
  pageDescription,
  pageTitle,
  segmentHubDescription,
  segmentHubTitle,
} from '@/lib/company-stats-text';

export interface CompanyStatsPage {
  segment: string;
  segmentName: string;
  city: string;
  uf: string;
  total: number;
  openedLast12m: number;
  porte: { ME: number; EPP: number; DEMAIS: number };
  withPhonePct: number;
  withEmailPct: number;
  topBairros: Array<{ name: string; count: number }>;
}

interface CompanyStatsData {
  generatedAt: string;
  segments: Array<{ slug: string; name: string }>;
  cities?: Array<{ slug: string; name: string; uf: string }>;
  pages: Record<string, CompanyStatsPage>;
}

export interface HubLink {
  slug: string;
  label: string;
  total: number;
}

const DATA = data as CompanyStatsData;

export const COMPANY_STATS_BASE_PATH = 'empresas';
export const COMPANY_STATS_GENERATED_AT = DATA.generatedAt;

const pagesEntries = () => Object.entries(DATA.pages);

function citySlugOf(p: CompanyStatsPage): string {
  return (DATA.cities ?? []).find((c) => c.name === p.city && c.uf === p.uf)?.slug
    ?? `${p.city.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.uf.toLowerCase()}`;
}

export const cityHubSlug = (citySlug: string) => `em-${citySlug}`;

export function getCompanyStatsSlugs(): string[] {
  return Object.keys(DATA.pages);
}

export function getCompanyStatsPage(slug: string): CompanyStatsPage | null {
  return DATA.pages[slug] ?? null;
}

export function getCityHub(slug: string): { city: string; uf: string; total: number; links: HubLink[] } | null {
  if (!slug.startsWith('em-')) return null;
  const citySlug = slug.slice(3);
  const pages = pagesEntries().filter(([, p]) => citySlugOf(p) === citySlug);
  if (pages.length === 0) return null;
  const { city, uf } = pages[0]![1];
  const links = pages
    .map(([s, p]) => ({ slug: s, label: p.segmentName, total: p.total }))
    .sort((a, b) => b.total - a.total);
  return { city, uf, total: links.reduce((sum, l) => sum + l.total, 0), links };
}

export function getSegmentHub(slug: string): { segmentName: string; total: number; links: HubLink[] } | null {
  const segment = DATA.segments.find((s) => s.slug === slug);
  if (!segment) return null;
  const links = pagesEntries()
    .filter(([, p]) => p.segment === slug)
    .map(([s, p]) => ({ slug: s, label: `${p.city} (${p.uf})`, total: p.total }))
    .sort((a, b) => b.total - a.total);
  if (links.length === 0) return null;
  return { segmentName: segment.name, total: links.reduce((sum, l) => sum + l.total, 0), links };
}

export function getCityHubLinks(): HubLink[] {
  const byCity = new Map<string, HubLink>();
  for (const [, p] of pagesEntries()) {
    const slug = cityHubSlug(citySlugOf(p));
    const link = byCity.get(slug) ?? { slug, label: `${p.city} (${p.uf})`, total: 0 };
    link.total += p.total;
    byCity.set(slug, link);
  }
  return [...byCity.values()].sort((a, b) => b.total - a.total);
}

export function getSegmentHubLinks(): HubLink[] {
  return DATA.segments
    .map((s) => ({ slug: s.slug, label: s.name, total: getSegmentHub(s.slug)?.total ?? 0 }))
    .filter((l) => l.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function formatCount(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** Title/description for any /empresas/<slug> (null = unknown slug). */
export function companyRouteMeta(slug: string): { title: string; description: string } | null {
  const page = getCompanyStatsPage(slug);
  if (page) return { title: pageTitle(page), description: pageDescription(page) };
  const city = getCityHub(slug);
  if (city) return { title: cityHubTitle(city.city, city.uf, city.total), description: cityHubDescription(city.city, city.uf, city.total, city.links.length) };
  const segment = getSegmentHub(slug);
  if (segment) return { title: segmentHubTitle(segment.segmentName), description: segmentHubDescription(segment.segmentName, segment.links.length, segment.total) };
  return null;
}

/** Every indexable /empresas/<slug>: pages, city hubs and segment hubs. */
export function getAllCompanyRouteSlugs(): string[] {
  return [...getCompanyStatsSlugs(), ...getCityHubLinks().map((l) => l.slug), ...getSegmentHubLinks().map((l) => l.slug)];
}

/** Same city, other segments + same segment, other cities (internal linking). */
export function relatedCompanyStats(slug: string, limit = 6): HubLink[] {
  const page = DATA.pages[slug];
  if (!page) return [];
  const entries = pagesEntries().filter(([s]) => s !== slug);
  const sameCity = entries.filter(([, p]) => p.city === page.city && p.uf === page.uf)
    .sort((a, b) => b[1].total - a[1].total).slice(0, limit)
    .map(([s, p]) => ({ slug: s, label: `${p.segmentName} em ${p.city}`, total: p.total }));
  const sameSegment = entries.filter(([, p]) => p.segment === page.segment)
    .sort((a, b) => b[1].total - a[1].total).slice(0, limit)
    .map(([s, p]) => ({ slug: s, label: `${p.segmentName} em ${p.city}`, total: p.total }));
  return [...sameCity, ...sameSegment];
}

export function cityHubSlugForPage(p: CompanyStatsPage): string {
  return cityHubSlug(citySlugOf(p));
}

const OLD_NICHE_TO_SEGMENT: Record<string, string> = {
  dentistas: 'dentistas',
  imobiliarias: 'imobiliarias',
  contadores: 'escritorios-de-contabilidade',
  advogados: 'escritorios-de-advocacia',
  restaurantes: 'restaurantes',
  clinicas: 'clinicas-medicas',
};

/**
 * Data page for an older local SEO entry ("prospeccao-b2b-dentistas-santos"): the matching
 * "/empresas/dentistas-em-santos-sp" (or the city hub when there is no niche).
 */
export function companyLinkForLocalEntry(entry: { city?: string; niche?: string; slug: string }): { href: string; label: string; total: number } | null {
  if (!entry.city) return null;
  const citySlug = (DATA.cities ?? []).find((c) => c.name.toLowerCase() === entry.city!.toLowerCase())?.slug;
  if (!citySlug) return null;
  const nicheKey = Object.keys(OLD_NICHE_TO_SEGMENT).find((k) => entry.slug.includes(`-${k}-`));
  if (nicheKey) {
    const pageSlug = `${OLD_NICHE_TO_SEGMENT[nicheKey]}-em-${citySlug}`;
    const page = DATA.pages[pageSlug];
    if (page) return { href: `/${COMPANY_STATS_BASE_PATH}/${pageSlug}`, label: `Lista de ${page.segmentName} em ${page.city}`, total: page.total };
  }
  const hub = getCityHub(cityHubSlug(citySlug));
  return hub ? { href: `/${COMPANY_STATS_BASE_PATH}/${cityHubSlug(citySlug)}`, label: `Empresas em ${hub.city} por segmento`, total: hub.total } : null;
}

