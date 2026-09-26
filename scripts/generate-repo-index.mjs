import { readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const root = join(import.meta.dirname, '..');
const outPath = join(root, 'memory', 'repository-index.md');

const ignore = new Set([
  'node_modules', '.git', 'dist', '.next', 'build', 'coverage',
  '.cache', 'docker', 'public', '.cursor', '.vscode', '.opencode',
  '.claude', 'scripts', 'memory',
]);

function scan(dir, depth = 0) {
  if (depth > 4) return [];
  const entries = [];
  try {
    for (const name of readdirSync(dir)) {
      if (ignore.has(name) || name.startsWith('.')) continue;
      const full = join(dir, name);
      const stat = statSync(full);
      entries.push({
        path: relative(root, full),
        isDir: stat.isDirectory(),
        size: stat.size,
      });
      if (stat.isDirectory()) entries.push(...scan(full, depth + 1));
    }
  } catch {}
  return entries;
}

function buildGraphs(entries) {
  const dirs = entries.filter(e => e.isDir).map(e => e.path);
  const files = entries.filter(e => !e.isDir);
  return { dirs, files };
}

function detectStack(files) {
  const stack = [];
  if (files.some(f => f.path.endsWith('package.json') && !f.path.includes('node_modules'))) stack.push('npm');
  if (files.some(f => f.path.endsWith('tsconfig.json'))) stack.push('TypeScript');
  if (files.some(f => f.path.startsWith('frontend/'))) stack.push('Frontend');
  if (files.some(f => f.path.startsWith('admin/'))) stack.push('Admin');
  if (files.some(f => f.path.startsWith('backend/'))) stack.push('Backend');
  if (files.some(f => f.path.endsWith('prisma/schema.prisma'))) stack.push('Prisma');
  if (files.some(f => f.path.endsWith('docker-compose.yml'))) stack.push('Docker');
  return [...new Set(stack)];
}

function detectAPIEndpoints(files) {
  const api = files.filter(f =>
    f.path.includes('/api/') || f.path.includes('/routes/') ||
    f.path.includes('route.ts') || f.path.includes('api.ts')
  );
  return api.map(f => f.path);
}

const entries = scan(root);
const { dirs, files } = buildGraphs(entries);
const stack = detectStack(files);
const apiFiles = detectAPIEndpoints(files);

const md = `# Repository Index

> Auto-generated at ${new Date().toISOString()}

## Stack

${stack.map(s => `- ${s}`).join('\n')}

## Structure

${dirs.map(d => `- ${d}/`).join('\n')}

## Source Files

${files.filter(f => !f.path.includes('node_modules')).map(f => `- ${f.path} (${(f.size / 1024).toFixed(1)}KB)`).join('\n')}

## API Routes

${apiFiles.length ? apiFiles.map(f => `- ${f}`).join('\n') : '*Nenhum endpoint detectado*'}

## Dependency Graph

${stack.includes('npm') ? 'npm workspaces: frontend, admin, backend' : ''}

## Database Graph

${stack.includes('Prisma') ? 'Prisma schema: backend/prisma/schema.prisma' : ''}

---
*Reindex: node scripts/generate-repo-index.mjs*
`;

writeFileSync(outPath, md);
console.log(`Index written to ${outPath} — ${entries.length} entries, ${files.length} files`);
