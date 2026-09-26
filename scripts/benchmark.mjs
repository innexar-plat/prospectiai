import { join } from 'path';

const root = join(import.meta.dirname, '..');

const REFS = {
  Stripe: 'https://stripe.com',
  Linear: 'https://linear.app',
  Apple: 'https://apple.com',
  Arc: 'https://arc.net',
  Raycast: 'https://raycast.com',
  Notion: 'https://notion.so',
  Airbnb: 'https://airbnb.com',
  Vercel: 'https://vercel.com',
  GitHub: 'https://github.com',
};

const CATEGORIES = {
  Stripe: ['dashboard', 'pricing page', 'forms', 'authentication'],
  Linear: ['app UI', 'dark mode', 'keyboard shortcuts', 'status page'],
  Apple: ['product page', 'navigation', 'typography', 'animations'],
  Arc: ['browser UI', 'spaces', 'sidebar'],
  Raycast: ['command palette', 'extensions', 'onboarding'],
  Notion: ['editor', 'documents', 'templates', 'databases'],
  Airbnb: ['search', 'calendar', 'checkout flow'],
  Vercel: ['dashboard', 'deployments', 'analytics'],
  GitHub: ['code review', 'issues', 'pull requests', 'actions'],
};

export function benchmark(task) {
  const relevant = Object.entries(REFS).filter(([name]) =>
    CATEGORIES[name].some(cat => task.toLowerCase().includes(cat.toLowerCase()))
  );

  const results = relevant.length ? relevant : Object.entries(REFS);

  const out = [
    `# UI Benchmark: ${task}`,
    ``,
    `## Referências para pesquisa`,
    ``,
    ...results.map(([name, url]) => {
      const cats = CATEGORIES[name].join(', ');
      return `### ${name}\n- URL: ${url}\n- Inspirar em: ${cats}\n`;
    }),
    ``,
    `## Direção`,
    `Analisar as referências acima e produzir algo inspirado (não copiado).`,
    `Documentar decisões de design em memory/design-system.md.`,
  ].join('\n');

  const outPath = join(root, 'memory', 'benchmark.md');
  require('fs').writeFileSync(outPath, out);
  console.log(`Benchmark saved to ${outPath}`);
  console.log(`${results.length} referências identificadas para "${task}"`);
}

if (process.argv[1] === import.meta.filename) {
  benchmark(process.argv.slice(2).join(' ') || 'UI component');
}
