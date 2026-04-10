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
const BASE_URL = 'https://precisionia.com.br';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Lista de rotas indexáveis com título e descrição (alinhado a seo-local + Privacy/Terms) */
function getIndexableRoutes() {
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
    {
      path: 'privacy',
      title: 'Política de Privacidade | PrecisionAI',
      description:
        'Política de Privacidade do PrecisionAI. LGPD, cookies, dados coletados e seus direitos.',
    },
    {
      path: 'terms',
      title: 'Termos de Uso | PrecisionAI',
      description:
        'Termos de Uso do PrecisionAI. Aceitação, serviço, pagamentos e cancelamento.',
    },
  ];
  const cities = ['praia-grande', 'santos', 'sao-paulo', 'guaruja', 'sao-vicente', 'rio-de-janeiro', 'belo-horizonte', 'curitiba', 'porto-alegre', 'campinas'];
  for (const c of cities) {
    const cityName = cityNames[c] || c;
    routes.push({
      path: `geracao-de-leads-b2b-${c}`,
      title: `Geração de Leads B2B em ${cityName} | PrecisionAI`,
      description: `Ferramenta de inteligência comercial B2B para empresas em ${cityName}. Busca por nicho, análise de concorrência e leads qualificados.`,
    });
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
      routes.push({
        path: `prospeccao-b2b-${n.slug}-${c}`,
        title: `Prospecção B2B para ${n.name} em ${cityName} | PrecisionAI`,
        description: `Prospecção B2B para ${n.name} em ${cityName}. Encontre empresas, analise concorrência e gere leads com IA.`,
      });
    }
  }

  // Blog routes
  const blogPosts = [
    { slug: 'como-encontrar-empresas-para-vender', title: 'Como Encontrar Empresas para Vender', desc: 'Guia completo: 7 estratégias para encontrar empresas ideais e vender mais em 2026.' },
    { slug: 'como-prospectar-clientes-b2b', title: 'Como Prospectar Clientes B2B', desc: 'Aprenda técnicas de prospecção B2B que realmente funcionam para gerar leads qualificados.' },
    { slug: 'como-vender-para-empresas', title: 'Como Vender para Empresas', desc: 'Estratégias práticas para vender produtos e serviços no mercado B2B.' },
    { slug: 'geracao-de-leads-b2b-guia-completo', title: 'Geração de Leads B2B — Guia Completo', desc: 'Tudo sobre geração de leads B2B: canais, ferramentas, métricas e boas práticas.' },
    { slug: 'ferramentas-prospeccao-comercial', title: 'Ferramentas de Prospecção Comercial', desc: 'As melhores ferramentas para prospecção comercial B2B em 2026.' },
    { slug: 'dicas-vendas-b2b', title: 'Dicas de Vendas B2B', desc: '10 dicas práticas para aumentar suas vendas no mercado B2B.' },
  ];
  for (const bp of blogPosts) {
    routes.push({
      path: `blog/${bp.slug}`,
      title: `${bp.title} | Blog PrecisionAI`,
      description: bp.desc,
    });
  }
  routes.push({
    path: 'blog',
    title: 'Blog PrecisionAI — Dicas de Vendas B2B, Prospecção e Geração de Leads',
    description: 'Blog sobre vendas B2B, prospecção de clientes, geração de leads e como encontrar empresas para vender.',
  });
  // Integration pages
  routes.push({
    path: 'integracoes/rdstation',
    title: 'Integração PrecisionAI + RD Station CRM | Envie Leads Automaticamente',
    description: 'Conecte o PrecisionAI ao RD Station CRM e envie leads prospectados direto para seu funil de vendas.',
  });
  routes.push({
    path: 'integracoes/agendor',
    title: 'Integração PrecisionAI + Agendor CRM | Envie Leads Automaticamente',
    description: 'Conecte o PrecisionAI ao Agendor e envie leads prospectados direto para seu CRM.',
  });
  routes.push({
    path: 'integracoes/hubspot',
    title: 'Integração PrecisionAI + HubSpot CRM | Envie Leads Automaticamente',
    description: 'Conecte o PrecisionAI ao HubSpot CRM via OAuth e envie leads prospectados direto para seu funil de vendas.',
  });

  return routes;
}

function replaceMeta(html, { url, title, description }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);
  out = out.replace(
    /<meta name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  out = out.replace(
    /<link rel="canonical" href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${url}" />`
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${url}" />`
  );
  out = out.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  out = out.replace(
    /<meta property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  out = out.replace(
    /<meta name="twitter:url" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:url" content="${url}" />`
  );
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );
  return out;
}

function main() {
  const indexPath = path.join(DIST, 'index.html');
  let indexHtml;
  try {
    indexHtml = readFileSync(indexPath, 'utf8');
  } catch (e) {
    console.error('Erro: dist/index.html não encontrado. Rode "npm run build" antes.');
    process.exit(1);
  }

  const routes = getIndexableRoutes();
  for (const r of routes) {
    const url = `${BASE_URL}/${r.path}`;
    const html = replaceMeta(indexHtml, {
      url,
      title: r.title,
      description: r.description,
    });
    const outPath = path.join(DIST, `${r.path}.html`);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    console.log('Gerado:', outPath);
  }
  console.log('Total:', routes.length, 'páginas');
}

main();
