#!/usr/bin/env node
/** Lists keys present in baseline locale but missing in target. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const baseline = process.argv[2] || 'pt';
const target = process.argv[3] || 'en';

const MESSAGE_FILES = [
  'src/lib/i18n/common-messages.ts',
  'src/lib/i18n/pages-messages.ts',
  'src/lib/i18n/dashboard-messages.ts',
  'src/lib/i18n/support-messages.ts',
  'src/lib/i18n/landing-messages.ts',
  'src/lib/i18n/conv-messages.ts',
  'src/lib/i18n/log-messages.ts',
];

function extractLocaleBlock(content, locale) {
  const marker = `${locale}: {`;
  const localeStart = content.indexOf(marker);
  if (localeStart === -1) return '';
  let depth = 0;
  let started = false;
  const startBrace = localeStart + marker.length - 1;
  for (let i = startBrace; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') {
      depth++;
      started = true;
    } else if (ch === '}') {
      depth--;
      if (started && depth === 0) return content.slice(localeStart, i + 1);
    }
  }
  return '';
}

function extractKeys(block) {
  const keys = new Set();
  const re = /^\s+'([^']+)':/gm;
  let m;
  while ((m = re.exec(block)) !== null) keys.add(m[1]);
  return keys;
}

function extractValue(content, locale, key) {
  const block = extractLocaleBlock(content, locale);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`'${escaped}':\\s*'((?:\\\\'|[^'])*)'`);
  const m = block.match(re);
  return m ? m[1].replace(/\\'/g, "'") : null;
}

const baseKeys = new Set();
const targetKeys = new Set();
const values = new Map();

for (const rel of MESSAGE_FILES) {
  const content = fs.readFileSync(path.join(root, rel), 'utf8');
  const base = extractKeys(extractLocaleBlock(content, baseline));
  const tgt = extractKeys(extractLocaleBlock(content, target));
  for (const k of base) {
    baseKeys.add(k);
    if (!values.has(k)) values.set(k, extractValue(content, baseline, k) || extractValue(content, 'en', k));
  }
  for (const k of tgt) targetKeys.add(k);
}

const missing = [...baseKeys].filter((k) => !targetKeys.has(k)).sort();
console.log(`Missing ${target} vs ${baseline}: ${missing.length}`);
for (const k of missing) {
  console.log(`${k}\t${(values.get(k) || '').slice(0, 100)}`);
}
