import { readFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..');

export function learn({ right, wrong, patterns, type }) {
  const lessons = join(root, 'memory', 'lessons.md');
  const patternsFile = join(root, 'memory', 'patterns.md');

  const entry = `
## ${new Date().toISOString().split('T')[0]} — ${type}

### O que deu certo
${right.map(r => `- ${r}`).join('\n')}

### O que deu errado / lições
${wrong.map(w => `- ${w}`).join('\n')}
`;

  appendFileSync(lessons, entry);

  if (patterns?.length) {
    const patternEntry = patterns.map(p =>
      `- ${p}`
    ).join('\n');
    appendFileSync(patternsFile, `\n${patternEntry}`);
  }

  console.log(`Learning saved to memory/`);
}

// CLI usage
if (process.argv[1] === import.meta.filename) {
  const args = process.argv.slice(2);
  learn({
    right: ['Tarefa concluída com planejamento prévio'],
    wrong: ['N/A'],
    patterns: args.length ? args : ['N/A'],
    type: 'Manual',
  });
}
