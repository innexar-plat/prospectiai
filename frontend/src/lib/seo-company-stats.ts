/**
 * Public "Empresas de <segmento> em <cidade>" pages: aggregate numbers from the Receita base
 * (scripts/seo-company-stats.py writes src/data/seo-company-stats.json). Never contacts.
 * scripts/generate-seo-html.mjs reads the same JSON for the static HTML and the sitemap.
 */
import data from '@/data/seo-company-stats.json';

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
  pages: Record<string, CompanyStatsPage>;
}

const DATA = data as CompanyStatsData;

export const COMPANY_STATS_BASE_PATH = 'empresas';
export const COMPANY_STATS_GENERATED_AT = DATA.generatedAt;

export function getCompanyStatsSlugs(): string[] {
  return Object.keys(DATA.pages);
}

export function getCompanyStatsPage(slug: string): CompanyStatsPage | null {
  return DATA.pages[slug] ?? null;
}

export function formatCount(n: number): string {
  return n.toLocaleString('pt-BR');
}

export function companyStatsTitle(p: CompanyStatsPage): string {
  return `${p.segmentName} em ${p.city} (${p.uf}): ${formatCount(p.total)} empresas ativas | Precision`;
}

export function companyStatsDescription(p: CompanyStatsPage): string {
  return `Lista de ${p.segmentName.toLowerCase()} em ${p.city}-${p.uf}: ${formatCount(p.total)} empresas ativas na Receita Federal, ${formatCount(p.openedLast12m)} abertas nos últimos 12 meses. Veja bairros, porte e como prospectar.`;
}

/** Same city, other segments + same segment, other cities (internal linking). */
export function relatedCompanyStats(slug: string, limit = 6): Array<{ slug: string; label: string }> {
  const page = DATA.pages[slug];
  if (!page) return [];
  const entries = Object.entries(DATA.pages).filter(([s]) => s !== slug);
  const sameCity = entries.filter(([, p]) => p.city === page.city && p.uf === page.uf)
    .sort((a, b) => b[1].total - a[1].total).slice(0, limit)
    .map(([s, p]) => ({ slug: s, label: `${p.segmentName} em ${p.city}` }));
  const sameSegment = entries.filter(([, p]) => p.segment === page.segment)
    .sort((a, b) => b[1].total - a[1].total).slice(0, limit)
    .map(([s, p]) => ({ slug: s, label: `${p.segmentName} em ${p.city}` }));
  return [...sameCity, ...sameSegment];
}
