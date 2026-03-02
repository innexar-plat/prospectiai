/**
 * Post-build: gera HTML estático por rota com title, description e canonical corretos
 * para que crawlers (Google) recebam meta adequada no primeiro response e indexem as páginas.
 * Uso: node scripts/generate-seo-html.mjs (rodar após vite build, a partir de frontend/)
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE_URL = 'https://prospectorai.innexar.com.br';

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
    'sao-paulo': 'Sao Paulo',
    guaruja: 'Guaruja',
    'sao-vicente': 'Sao Vicente',
  };
  const routes = [
    {
      path: 'privacy',
      title: 'Política de Privacidade | ProspectorAI',
      description:
        'Política de Privacidade do ProspectorAI. LGPD, cookies, dados coletados e seus direitos.',
    },
    {
      path: 'terms',
      title: 'Termos de Uso | ProspectorAI',
      description:
        'Termos de Uso do ProspectorAI. Aceitação, serviço, pagamentos e cancelamento.',
    },
  ];
  const cities = ['praia-grande', 'santos', 'sao-paulo', 'guaruja', 'sao-vicente'];
  for (const c of cities) {
    const cityName = cityNames[c] || c;
    routes.push({
      path: `geracao-de-leads-b2b-${c}`,
      title: `Geração de Leads B2B em ${cityName} | Innexar`,
      description: `Ferramenta de inteligência comercial B2B para empresas em ${cityName}. Busca por nicho, análise de concorrência e leads qualificados.`,
    });
  }
  const niches = [
    { slug: 'dentistas', name: 'Dentistas' },
    { slug: 'imobiliarias', name: 'Imobiliárias' },
    { slug: 'contadores', name: 'Contadores' },
  ];
  const citiesNicho = ['praia-grande', 'santos', 'sao-paulo'];
  for (const n of niches) {
    for (const c of citiesNicho) {
      const cityName = cityNames[c] || c;
      routes.push({
        path: `prospeccao-b2b-${n.slug}-${c}`,
        title: `Prospecção B2B para ${n.name} em ${cityName} | Innexar`,
        description: `Prospecção B2B para ${n.name} em ${cityName}. Encontre empresas, analise concorrência e gere leads com IA.`,
      });
    }
  }
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
    writeFileSync(outPath, html);
    console.log('Gerado:', outPath);
  }
  console.log('Total:', routes.length, 'páginas');
}

main();
