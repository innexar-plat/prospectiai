/**
 * Post-build: gera HTML estático por rota com title, description e canonical corretos
 * para que crawlers (Google) recebam meta adequada no primeiro response e indexem as páginas.
 * Uso: node scripts/generate-seo-html.mjs (rodar após vite build, a partir de frontend/)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const MARKET = process.env.VITE_MARKET === 'US' ? 'US' : 'BR';
const BR_ORIGIN = 'https://precisionia.com.br';
const US_ORIGIN = 'https://precisionai.innexar.app';
const BASE_URL = MARKET === 'US' ? US_ORIGIN : BR_ORIGIN;

/** Keep in sync with frontend/src/lib/sitemap-routes.ts */
function getUsIndexableRoutes() {
  return [
    { path: '', title: 'Precision — B2B Lead Generation & Prospecting with AI', description: 'Find and qualify B2B companies by niche and location. AI-powered prospecting, lead scoring, and CRM export. Start at $19/mo.', priority: '1.0', changefreq: 'weekly' },
    { path: 'en', title: 'Precision — B2B Lead Generation & Prospecting with AI', description: 'Find and qualify B2B companies by niche and location. AI-powered prospecting, lead scoring, and CRM export.', priority: '0.9', changefreq: 'weekly' },
    { path: 'pricing', title: 'Pricing | Precision — B2B Prospecting Platform', description: 'Precision pricing: Starter plan at $19/mo with 50 credits. AI prospecting, lead scoring, and team workspaces.', priority: '0.9', changefreq: 'weekly' },
    { path: 'en/pricing', title: 'Pricing | Precision — B2B Prospecting Platform', description: 'Precision pricing: Starter plan at $19/mo with 50 credits. AI prospecting, lead scoring, and team workspaces.', priority: '0.9', changefreq: 'weekly' },
    { path: 'es/pricing', title: 'Precios | Precision — Plataforma de prospección B2B', description: 'Precios de Precision: plan Starter a $19/mes con 50 créditos. Prospección con IA y exportación a CRM.', priority: '0.8', changefreq: 'weekly' },
    { path: 'privacy', title: 'Privacy Policy | Precision', description: 'Precision privacy policy. Data collection, cookies, your rights, and how we protect your information.', priority: '0.3', changefreq: 'monthly' },
    { path: 'terms', title: 'Terms of Service | Precision', description: 'Precision terms of service. Subscription, billing, acceptable use, and cancellation.', priority: '0.3', changefreq: 'monthly' },
    { path: 'integracoes/hubspot', title: 'Precision + HubSpot CRM Integration', description: 'Connect Precision to HubSpot CRM via OAuth and send qualified B2B leads straight into your pipeline.', priority: '0.7', changefreq: 'monthly' },
  ];
}

function getBrIndexableRoutes() {
  const cityNames = {
    'praia-grande': 'Praia Grande',
    santos: 'Santos',
    'sao-paulo': 'São Paulo',
    guaruja: 'Guarujá',
    'sao-vicente': 'São Vicente',
    'rio-de-janeiro': 'Rio de Janeiro',
    'belo-horizonte': 'Belo Horizonte',
    curitiba: 'Curitiba',
    'porto-alegre': 'Porto Alegre',
    campinas: 'Campinas',
  };
  const routes = [
    { path: '', title: 'Precision — Como Encontrar Empresas para Vender | Prospecção B2B com IA', description: 'Descubra como encontrar empresas para vender seus produtos e serviços. Plataforma de prospecção B2B com inteligência artificial.', priority: '1.0', changefreq: 'weekly' },
    { path: 'mapa-do-site', title: 'Mapa do Site | Precision', description: 'Mapa do site da Precision com links para blog, integrações e páginas locais de prospecção B2B.', priority: '0.7', changefreq: 'weekly' },
    { path: 'blog', title: 'Blog Precision — Dicas de Vendas B2B, Prospecção e Geração de Leads', description: 'Blog sobre vendas B2B, prospecção de clientes, geração de leads e como encontrar empresas para vender.', priority: '0.9', changefreq: 'weekly' },
    { path: 'privacy', title: 'Política de Privacidade | Precision', description: 'Política de Privacidade do Precision. LGPD, cookies, dados coletados e seus direitos.', priority: '0.3', changefreq: 'monthly' },
    { path: 'terms', title: 'Termos de Uso | Precision', description: 'Termos de Uso do Precision. Aceitação, serviço, pagamentos e cancelamento.', priority: '0.3', changefreq: 'monthly' },
    { path: 'integracoes/rdstation', title: 'Integração Precision + RD Station CRM', description: 'Conecte o Precision ao RD Station CRM e envie leads prospectados direto para seu funil de vendas.', priority: '0.7', changefreq: 'monthly' },
    { path: 'integracoes/agendor', title: 'Integração Precision + Agendor CRM', description: 'Conecte o Precision ao Agendor e envie leads prospectados direto para seu CRM.', priority: '0.7', changefreq: 'monthly' },
    { path: 'integracoes/hubspot', title: 'Integração Precision + HubSpot CRM', description: 'Conecte o Precision ao HubSpot CRM via OAuth e envie leads prospectados direto para seu funil de vendas.', priority: '0.7', changefreq: 'monthly' },
    { path: 'pricing', title: 'Preços | Precision — Planos de Prospecção B2B', description: 'Planos acessíveis para prospecção B2B com IA. A partir de R$ 49/mês com 50 créditos. Score IA, exportação para CRM e workspace de equipe.', priority: '0.9', changefreq: 'weekly' },
  ];

  const blogPosts = [
    { slug: 'como-encontrar-empresas-para-vender', title: 'Como Encontrar Empresas para Vender', desc: 'Guia completo: 7 estratégias para encontrar empresas ideais e vender mais em 2026.' },
    { slug: 'como-prospectar-clientes-b2b', title: 'Como Prospectar Clientes B2B', desc: 'Aprenda técnicas de prospecção B2B que realmente funcionam para gerar leads qualificados.' },
    { slug: 'como-vender-para-empresas', title: 'Como Vender para Empresas', desc: 'Estratégias práticas para vender produtos e serviços no mercado B2B.' },
    { slug: 'geracao-de-leads-b2b-guia-completo', title: 'Geração de Leads B2B — Guia Completo', desc: 'Tudo sobre geração de leads B2B: canais, ferramentas, métricas e boas práticas.' },
    { slug: 'ferramentas-prospeccao-comercial', title: 'Ferramentas de Prospecção Comercial', desc: 'As melhores ferramentas para prospecção comercial B2B em 2026.' },
    { slug: 'dicas-vendas-b2b', title: 'Dicas de Vendas B2B', desc: '10 dicas práticas para aumentar suas vendas no mercado B2B.' },
  ];
  for (const bp of blogPosts) {
    routes.push({ path: `blog/${bp.slug}`, title: `${bp.title} | Blog Precision`, description: bp.desc, priority: '0.9', changefreq: 'monthly' });
  }
  const cities = Object.keys(cityNames);
  for (const c of cities) {
    const cityName = cityNames[c] || c;
    routes.push({ path: `geracao-de-leads-b2b-${c}`, title: `Geração de Leads B2B em ${cityName} | Precision`, description: `Ferramenta de inteligência comercial B2B para empresas em ${cityName}. Busca por nicho, análise de concorrência e leads qualificados.`, priority: '0.8', changefreq: 'weekly' });
  }
  const niches = [
    { slug: 'dentistas', name: 'Dentistas' },
    { slug: 'imobiliarias', name: 'Imobiliárias' },
    { slug: 'contadores', name: 'Contadores' },
    { slug: 'advogados', name: 'Advogados' },
    { slug: 'restaurantes', name: 'Restaurantes' },
    { slug: 'clinicas', name: 'Clínicas' },
  ];
  const citiesNicho = ['praia-grande', 'santos', 'sao-paulo'];
  for (const n of niches) {
    for (const c of citiesNicho) {
      const cityName = cityNames[c] || c;
      routes.push({ path: `prospeccao-b2b-${n.slug}-${c}`, title: `Prospecção B2B para ${n.name} em ${cityName} | Precision`, description: `Prospecção B2B para ${n.name} em ${cityName}. Encontre empresas, analise concorrência e gere leads com IA.`, priority: '0.7', changefreq: 'weekly' });
    }
  }
  return routes;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function routeToUrl(origin, route) {
  return route.path ? `${origin}/${route.path}` : `${origin}/`;
}

function writeSitemap(origin, routes, filename) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  for (const r of routes) {
    lines.push('  <url>');
    lines.push(`    <loc>${routeToUrl(origin, r)}</loc>`);
    lines.push(`    <lastmod>${date}</lastmod>`);
    lines.push(`    <changefreq>${r.changefreq}</changefreq>`);
    lines.push(`    <priority>${r.priority}</priority>`);
    lines.push('  </url>');
  }
  lines.push('</urlset>');
  const out = path.join(DIST, filename);
  writeFileSync(out, `${lines.join('\n')}\n`);
  console.log('Gerado:', out);
}

function replaceMeta(html, { url, title, description }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);
  out = out.replace(/<meta name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${safeDesc}" />`);
  out = out.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);
  out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${safeTitle}" />`);
  out = out.replace(/<meta property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${safeDesc}" />`);
  out = out.replace(/<meta name="twitter:url" content="[^"]*"\s*\/?>/i, `<meta name="twitter:url" content="${url}" />`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${safeTitle}" />`);
  out = out.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${safeDesc}" />`);
  return out;
}

function generatePerRouteHtml(indexHtml, routes, origin) {
  for (const r of routes) {
    if (!r.path) continue;
    const url = routeToUrl(origin, r);
    const html = replaceMeta(indexHtml, { url, title: r.title, description: r.description });
    const outPath = path.join(DIST, `${r.path}.html`);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    console.log('Gerado:', outPath);
  }
}

function main() {
  const indexPath = path.join(DIST, 'index.html');
  let indexHtml;
  try {
    indexHtml = readFileSync(indexPath, 'utf8');
  } catch {
    console.error('Erro: dist/index.html não encontrado. Rode "npm run build" antes.');
    process.exit(1);
  }

  const brRoutes = getBrIndexableRoutes();
  const usRoutes = getUsIndexableRoutes();

  writeSitemap(BR_ORIGIN, brRoutes, 'sitemap.xml');
  writeSitemap(US_ORIGIN, usRoutes, 'sitemap-us.xml');

  try {
    writeFileSync(path.join(PUBLIC, 'sitemap-us.xml'), readFileSync(path.join(DIST, 'sitemap-us.xml')));
    console.log('Atualizado:', path.join(PUBLIC, 'sitemap-us.xml'));
  } catch (e) {
    console.warn('Aviso: não foi possível atualizar public/sitemap-us.xml', e);
  }

  const activeRoutes = MARKET === 'US' ? usRoutes : brRoutes;
  generatePerRouteHtml(indexHtml, activeRoutes, BASE_URL);

  if (MARKET === 'US') {
    writeFileSync(path.join(DIST, 'sitemap.xml'), readFileSync(path.join(DIST, 'sitemap-us.xml')));
    console.log('US build: sitemap.xml aponta para rotas US');
  }

  console.log('Mercado:', MARKET, '| Rotas HTML:', activeRoutes.filter((r) => r.path).length, '| US sitemap:', usRoutes.length, 'URLs');
}

main();
