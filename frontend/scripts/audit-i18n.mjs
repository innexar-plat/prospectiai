#!/usr/bin/env node
/**
 * Audits i18n message files: compares EN/ES keys against PT baseline.
 * Usage: node scripts/audit-i18n.mjs [--json] [--top N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const MESSAGE_FILES = [
  'src/lib/i18n/common-messages.ts',
  'src/lib/i18n/pages-messages.ts',
  'src/lib/i18n/dashboard-messages.ts',
  'src/lib/i18n/support-messages.ts',
  'src/lib/i18n/landing-messages.ts',
  'src/lib/i18n/conv-messages.ts',
  'src/lib/i18n/log-messages.ts',
  'src/lib/i18n/legal-messages.ts',
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
      if (started && depth === 0) {
        return content.slice(localeStart, i + 1);
      }
    }
  }
  return '';
}

function extractKeys(block) {
  const keys = new Set();
  const re = /^\s+'([^']+)':/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

function extractValue(content, locale, key) {
  const block = extractLocaleBlock(content, locale);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`'${escaped}':\\s*'((?:\\\\'|[^'])*)'`);
  const m = block.match(re);
  return m ? m[1].replace(/\\'/g, "'") : null;
}

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const topIdx = args.indexOf('--top');
const topN = topIdx >= 0 ? Number(args[topIdx + 1]) || 20 : 20;

const byFile = {};
const allPt = new Set();
const allEn = new Set();
const allEs = new Set();
const ptValues = new Map();

for (const rel of MESSAGE_FILES) {
  const filePath = path.join(root, rel);
  const content = fs.readFileSync(filePath, 'utf8');
  const pt = extractKeys(extractLocaleBlock(content, 'pt'));
  const en = extractKeys(extractLocaleBlock(content, 'en'));
  const es = extractKeys(extractLocaleBlock(content, 'es'));

  const missingEn = [...pt].filter((k) => !en.has(k));
  const missingEs = [...pt].filter((k) => !es.has(k));

  byFile[path.basename(rel)] = {
    pt: pt.size,
    en: en.size,
    es: es.size,
    missingEn: missingEn.length,
    missingEs: missingEs.length,
  };

  for (const k of pt) {
    allPt.add(k);
    if (!ptValues.has(k)) {
      ptValues.set(k, extractValue(content, 'pt', k));
    }
  }
  for (const k of en) allEn.add(k);
  for (const k of es) allEs.add(k);
}

const missingEn = [...allPt].filter((k) => !allEn.has(k)).sort();
const missingEs = [...allPt].filter((k) => !allEs.has(k)).sort();

const report = {
  summary: {
    pt: allPt.size,
    en: allEn.size,
    es: allEs.size,
    missingEn: missingEn.length,
    missingEs: missingEs.length,
  },
  byFile,
  topMissingEn: missingEn.slice(0, topN).map((k) => ({ key: k, pt: ptValues.get(k) })),
  topMissingEs: missingEs.slice(0, topN).map((k) => ({ key: k, pt: ptValues.get(k) })),
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('=== i18n AUDIT SUMMARY ===');
  console.log(`PT keys: ${report.summary.pt}`);
  console.log(`EN keys: ${report.summary.en} | missing vs PT: ${report.summary.missingEn}`);
  console.log(`ES keys: ${report.summary.es} | missing vs PT: ${report.summary.missingEs}`);
  console.log('');
  console.log('=== BY FILE ===');
  for (const [name, d] of Object.entries(byFile)) {
    console.log(
      `${name}: pt=${d.pt} en=${d.en} (-${d.missingEn}) es=${d.es} (-${d.missingEs})`,
    );
  }
  console.log('');
  console.log(`=== TOP ${topN} MISSING EN ===`);
  for (const { key, pt } of report.topMissingEn) {
    console.log(`${key}${pt ? ` => ${pt.slice(0, 80)}` : ''}`);
  }
}

process.exit(report.summary.missingEn > 0 || report.summary.missingEs > 0 ? 1 : 0);
