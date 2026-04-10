#!/usr/bin/env node
/**
 * import-rf-data.mjs — Importa dados abertos da Receita Federal (CNPJ)
 *
 * Baixa e importa:
 *  1. Tabela de CNAEs (referência ~1.300 códigos)
 *  2. Empresas (razão social, porte, capital)
 *  3. Estabelecimentos (CNAE, endereço, telefone, email) — filtra apenas matrizes ativas
 *
 * Uso:
 *   node scripts/import-rf-data.mjs                       # Importa tudo
 *   node scripts/import-rf-data.mjs --cnae-only           # Só tabela CNAE
 *   node scripts/import-rf-data.mjs --batch 0             # Só batch 0
 *   node scripts/import-rf-data.mjs --skip-download       # Usa arquivos já baixados
 *
 * Requer: DATABASE_URL no .env ou como variável de ambiente.
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ───────────────────────────────────────────────────────────────────
// Receita Federal migrou para Nextcloud em arquivos.receitafederal.gov.br
// Acesso via WebDAV público com token gn672Ad4CF8N6TK
const RF_WEBDAV_BASE = 'https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ';
const RF_WEBDAV_TOKEN = 'gn672Ad4CF8N6TK';
const RF_WEBDAV_AUTH = 'Basic ' + Buffer.from(`${RF_WEBDAV_TOKEN}:`).toString('base64');
// Auto-detect latest month folder or use env override
const RF_MONTH = process.env.RF_MONTH || '2026-03';
const RF_BASE_URL = `${RF_WEBDAV_BASE}/${RF_MONTH}`;
const TEMP_DIR = join(__dirname, '..', '.rf-import-temp');
const BATCH_SIZE = 5000; // INSERT batch size (Empresas: 4 params × 5000 = 20K)
const ESTAB_BATCH_SIZE = 4000; // Estabelecimentos: 14 params × 4000 = 56K (pg limit: 65535)
const TOTAL_BATCHES = 10; // RF splits files 0-9

// Parse CLI args
const args = process.argv.slice(2);
const cnaeOnly = args.includes('--cnae-only');
const skipDownload = args.includes('--skip-download');
const batchArg = args.find((a) => a.startsWith('--batch'));
const specificBatch = batchArg ? parseInt(args[args.indexOf('--batch') + 1] ?? args[args.indexOf(batchArg)]?.split('=')[1], 10) : null;

// ── Database ─────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set. Set it in .env or as env var.');
  process.exit(1);
}

// Simple pg client using psql (available in the container) or pg module
async function execSQL(sql) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(sql);
    return result;
  } finally {
    await client.end();
  }
}

async function execBatchInserts(table, columns, rows) {
  if (rows.length === 0) return;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const colList = columns.join(', ');
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = batch.map((row, rowIdx) => {
        const rowPlaceholders = columns.map((_, colIdx) => {
          const paramIdx = rowIdx * columns.length + colIdx + 1;
          values.push(row[colIdx]);
          return `$${paramIdx}`;
        });
        return `(${rowPlaceholders.join(', ')})`;
      });
      await client.query(
        `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        values
      );
    }
  } finally {
    await client.end();
  }
}

async function getPool() {
  const { default: pg } = await import('pg');
  return new pg.Client({ connectionString: DATABASE_URL });
}

// ── Download helper ──────────────────────────────────────────────────────────
function downloadFileOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    const headers = {};
    // Add WebDAV auth for RF downloads
    if (url.includes('arquivos.receitafederal.gov.br')) {
      headers['Authorization'] = RF_WEBDAV_AUTH;
    }
    get(url, { timeout: 600000, headers }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        unlinkSync(dest);
        return downloadFileOnce(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastLog = 0;
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const now = Date.now();
        if (now - lastLog > 5000) {
          const pct = total ? ((downloaded / total) * 100).toFixed(1) : '?';
          const mb = (downloaded / 1048576).toFixed(1);
          process.stdout.write(`\r  📥 ${mb} MB (${pct}%)`);
          lastLog = now;
        }
      });
      pipeline(response, file).then(() => {
        console.log(`\r  ✅ Download completo: ${(downloaded / 1048576).toFixed(1)} MB`);
        resolve();
      }).catch(reject);
    }).on('error', (err) => {
      file.close();
      if (existsSync(dest)) unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadFile(url, dest, retries = 3) {
  if (existsSync(dest) && skipDownload) {
    console.log(`  ⏭️  Já existe: ${dest}`);
    return;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  ⬇️  Baixando: ${url}${attempt > 1 ? ` (tentativa ${attempt}/${retries})` : ''}`);
      await downloadFileOnce(url, dest);
      return;
    } catch (err) {
      if (existsSync(dest)) try { unlinkSync(dest); } catch {}
      if (attempt < retries) {
        console.log(`\n  ⚠️  Falha no download: ${err.message}. Retentando em 10s...`);
        await new Promise(r => setTimeout(r, 10000));
      } else {
        throw err;
      }
    }
  }
}

function unzipFile(zipPath, destDir) {
  console.log(`  📦 Extraindo: ${zipPath}`);
  execSync(`cd "${destDir}" && unzip -o "${zipPath}"`, { stdio: 'pipe' });
  const files = readdirSync(destDir).filter(f => !f.endsWith('.zip'));
  console.log(`  ✅ Extraído: ${files.join(', ')}`);
  return files;
}

// ── CSV Parser (RF uses semicolons, latin1/utf8 mixed, quoted fields) ────────
function parseRfCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

async function streamCsvLines(filePath, onLine) {
  const stream = createReadStream(filePath, { encoding: 'latin1' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNum = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    lineNum++;
    await onLine(parseRfCsvLine(line), lineNum);
  }
  return lineNum;
}

// ── Step 1: CNAE reference table ─────────────────────────────────────────────
async function importCnaes() {
  console.log('\n═══ Etapa 1: Tabela de referência CNAE ═══');
  const zipPath = join(TEMP_DIR, 'Cnaes.zip');
  const csvDir = join(TEMP_DIR, 'cnaes');
  mkdirSync(csvDir, { recursive: true });

  if (!skipDownload || !existsSync(zipPath)) {
    await downloadFile(`${RF_BASE_URL}/Cnaes.zip`, zipPath);
  }
  const files = unzipFile(zipPath, csvDir);
  const csvFile = files.find(f => f.toLowerCase().endsWith('.csv') || !f.includes('.')) || files[0];
  const csvPath = join(csvDir, csvFile);

  const rows = [];
  await streamCsvLines(csvPath, (fields) => {
    const [code, description] = fields;
    if (code && /^\d{7}$/.test(code.replace(/\D/g, '').padStart(7, '0'))) {
      const cleanCode = code.replace(/\D/g, '').padStart(7, '0');
      rows.push([cleanCode, description || '']);
    }
  });

  console.log(`  📊 ${rows.length} códigos CNAE encontrados`);
  await execSQL('DELETE FROM "CnaeCode"');
  await execBatchInserts('CnaeCode', ['"code"', '"description"'], rows);
  console.log(`  ✅ ${rows.length} CNAEs importados`);
  return rows;
}

// ── Step 2: Municipios reference (in memory) ─────────────────────────────────
async function loadMunicipios() {
  console.log('\n═══ Carregando municípios (referência) ═══');
  const zipPath = join(TEMP_DIR, 'Municipios.zip');
  const csvDir = join(TEMP_DIR, 'municipios');
  mkdirSync(csvDir, { recursive: true });

  if (!skipDownload || !existsSync(zipPath)) {
    await downloadFile(`${RF_BASE_URL}/Municipios.zip`, zipPath);
  }
  const files = unzipFile(zipPath, csvDir);
  const csvFile = files.find(f => f.toLowerCase().endsWith('.csv') || !f.includes('.')) || files[0];
  const csvPath = join(csvDir, csvFile);

  const map = new Map();
  await streamCsvLines(csvPath, (fields) => {
    const [code, name] = fields;
    if (code && name) {
      map.set(code.trim(), name.trim());
    }
  });
  console.log(`  ✅ ${map.size} municípios carregados em memória`);
  return map;
}

// ── Step 3: Import Empresas into temp table (for razaoSocial, porte, capital) ─
async function importEmpresas(batchNum) {
  const zipName = `Empresas${batchNum}.zip`;
  console.log(`\n── Importando ${zipName} ──`);
  const zipPath = join(TEMP_DIR, zipName);
  const csvDir = join(TEMP_DIR, `empresas${batchNum}`);
  mkdirSync(csvDir, { recursive: true });

  if (!skipDownload || !existsSync(zipPath)) {
    await downloadFile(`${RF_BASE_URL}/${zipName}`, zipPath);
  }
  const files = unzipFile(zipPath, csvDir);
  const csvFile = files.find(f => !f.endsWith('.zip')) || files[0];
  const csvPath = join(csvDir, csvFile);

  // Import into temp table
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const buffer = [];
    let total = 0;
    let lastLog = 0;

    await streamCsvLines(csvPath, async (fields, lineNum) => {
      // Empresas: cnpj_basico(0), razao_social(1), natureza_juridica(2), qualif(3), capital_social(4), porte(5), ente(6)
      const cnpjBase = (fields[0] || '').trim();
      const razaoSocial = (fields[1] || '').trim();
      const capitalStr = (fields[4] || '0').replace(',', '.');
      const porteCode = (fields[5] || '').trim();
      if (!cnpjBase || cnpjBase.length < 7) return;

      const porte = porteCode === '01' ? 'ME' : porteCode === '03' ? 'EPP' : porteCode === '05' ? 'DEMAIS' : null;
      const capital = parseFloat(capitalStr) || 0;

      buffer.push([cnpjBase.padStart(8, '0'), razaoSocial, porte, capital]);

      if (buffer.length >= BATCH_SIZE) {
        const batch = buffer.splice(0);
        total += batch.length;
        const values = [];
        const placeholders = batch.map((row, ri) => {
          values.push(row[0], row[1], row[2], row[3]);
          const base = ri * 4;
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
        });
        await client.query(
          `INSERT INTO _rf_empresa_temp (cnpj_base, razao_social, porte, capital_social) 
           VALUES ${placeholders.join(', ')} ON CONFLICT (cnpj_base) DO NOTHING`,
          values
        );
        const now = Date.now();
        if (now - lastLog > 3000) {
          process.stdout.write(`\r  📊 ${(total / 1000).toFixed(0)}K empresas...`);
          lastLog = now;
        }
      }
    });

    // Flush remaining
    if (buffer.length > 0) {
      const values = [];
      const placeholders = buffer.map((row, ri) => {
        values.push(row[0], row[1], row[2], row[3]);
        const base = ri * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
      });
      await client.query(
        `INSERT INTO _rf_empresa_temp (cnpj_base, razao_social, porte, capital_social) 
         VALUES ${placeholders.join(', ')} ON CONFLICT (cnpj_base) DO NOTHING`,
        values
      );
      total += buffer.length;
    }
    console.log(`\r  ✅ ${(total / 1000).toFixed(0)}K empresas importadas de ${zipName}`);
  } finally {
    await client.end();
  }

  // Cleanup CSV files (keep zip for potential re-runs)
  try { execSync(`rm -rf "${csvDir}"`); } catch { /* ok */ }
}

// ── Step 4: Import Estabelecimentos (only active + matriz) ───────────────────
async function importEstabelecimentos(batchNum, municipiosMap) {
  const zipName = `Estabelecimentos${batchNum}.zip`;
  console.log(`\n── Importando ${zipName} (filtro: ativas + matrizes) ──`);
  const zipPath = join(TEMP_DIR, zipName);
  const csvDir = join(TEMP_DIR, `estab${batchNum}`);
  mkdirSync(csvDir, { recursive: true });

  if (!skipDownload || !existsSync(zipPath)) {
    await downloadFile(`${RF_BASE_URL}/${zipName}`, zipPath);
  }
  const files = unzipFile(zipPath, csvDir);
  const csvFile = files.find(f => !f.endsWith('.zip')) || files[0];
  const csvPath = join(csvDir, csvFile);

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const buffer = [];
    let total = 0;
    let skipped = 0;
    let lastLog = 0;

    await streamCsvLines(csvPath, async (fields) => {
      // Estabelecimentos layout — see script header for column mapping
      const cnpjBase = (fields[0] || '').trim().padStart(8, '0');
      const cnpjOrdem = (fields[1] || '').trim().padStart(4, '0');
      const cnpjDv = (fields[2] || '').trim().padStart(2, '0');
      const matrizFilial = (fields[3] || '').trim();
      const nomeFantasia = (fields[4] || '').trim();
      const situacao = (fields[5] || '').trim();
      const dataAbertura = (fields[10] || '').trim();
      const cnaePrincipal = (fields[11] || '').trim().padStart(7, '0');
      const tipoLogradouro = (fields[13] || '').trim();
      const logradouro = (fields[14] || '').trim();
      const numero = (fields[15] || '').trim();
      const bairro = (fields[17] || '').trim();
      const cep = (fields[18] || '').replace(/\D/g, '').trim();
      const uf = (fields[19] || '').trim();
      const municipioCod = (fields[20] || '').trim();
      const ddd1 = (fields[21] || '').trim();
      const telefone1 = (fields[22] || '').trim();
      const email = (fields[27] || '').trim().toLowerCase();

      // Filter: only active (02) and headquarters (1)
      if (situacao !== '02' || matrizFilial !== '1') {
        skipped++;
        return;
      }
      if (!cnpjBase || cnpjBase.length < 8 || !cnaePrincipal || cnaePrincipal === '0000000') {
        skipped++;
        return;
      }

      const cnpj = `${cnpjBase}${cnpjOrdem}${cnpjDv}`;
      const municipio = municipiosMap.get(municipioCod) || null;
      const fullLogradouro = tipoLogradouro ? `${tipoLogradouro} ${logradouro}` : logradouro;

      buffer.push([
        cnpj, nomeFantasia || null, cnaePrincipal, uf, municipio,
        cep || null, bairro || null, fullLogradouro || null, numero || null,
        ddd1 || null, telefone1 || null, email || null, dataAbertura || null,
        cnpjBase, // for joining with empresa temp
      ]);

      if (buffer.length >= ESTAB_BATCH_SIZE) {
        const batch = buffer.splice(0);
        total += batch.length;
        await insertEstabBatch(client, batch);
        const now = Date.now();
        if (now - lastLog > 3000) {
          process.stdout.write(`\r  📊 ${(total / 1000).toFixed(0)}K empresas ativas (${(skipped / 1000).toFixed(0)}K ignoradas)...`);
          lastLog = now;
        }
      }
    });

    // Flush remaining
    if (buffer.length > 0) {
      total += buffer.length;
      await insertEstabBatch(client, buffer);
    }
    console.log(`\r  ✅ ${(total / 1000).toFixed(0)}K empresas ativas importadas, ${(skipped / 1000).toFixed(0)}K ignoradas`);
  } finally {
    await client.end();
  }

  // Cleanup
  try { execSync(`rm -rf "${csvDir}"`); } catch { /* ok */ }
}

async function insertEstabBatch(client, batch) {
  // Insert establishments joined with empresa temp data
  const values = [];
  const placeholders = batch.map((row, ri) => {
    const [cnpj, nomeFantasia, cnaePrincipal, uf, municipio, cep, bairro, logradouro, numero, ddd, telefone, email, dataAbertura, cnpjBase] = row;
    values.push(cnpj, cnpjBase, nomeFantasia, cnaePrincipal, uf, municipio, cep, bairro, logradouro, numero, ddd, telefone, email, dataAbertura);
    const b = ri * 14;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13}, $${b + 14})`;
  });

  await client.query(`
    INSERT INTO "RfCompany" ("cnpj", "razaoSocial", "nomeFantasia", "cnaePrincipal", "uf", "municipio", "cep", "bairro", "logradouro", "numero", "ddd", "telefone", "email", "dataAbertura", "porte", "capitalSocial")
    SELECT 
      v.cnpj,
      COALESCE(e.razao_social, 'N/D'),
      v.nome_fantasia,
      v.cnae_principal,
      v.uf,
      v.municipio,
      v.cep,
      v.bairro,
      v.logradouro,
      v.numero,
      v.ddd,
      v.telefone,
      v.email,
      v.data_abertura,
      e.porte,
      e.capital_social
    FROM (VALUES ${placeholders.join(', ')}) AS v(cnpj, cnpj_base, nome_fantasia, cnae_principal, uf, municipio, cep, bairro, logradouro, numero, ddd, telefone, email, data_abertura)
    LEFT JOIN _rf_empresa_temp e ON e.cnpj_base = v.cnpj_base
    ON CONFLICT ("cnpj") DO UPDATE SET
      "razaoSocial" = COALESCE(EXCLUDED."razaoSocial", "RfCompany"."razaoSocial"),
      "nomeFantasia" = COALESCE(EXCLUDED."nomeFantasia", "RfCompany"."nomeFantasia"),
      "porte" = COALESCE(EXCLUDED."porte", "RfCompany"."porte"),
      "capitalSocial" = COALESCE(EXCLUDED."capitalSocial", "RfCompany"."capitalSocial")
  `, values);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Importação de dados da Receita Federal');
  console.log(`   Fonte: ${RF_BASE_URL}`);
  console.log(`   Temp: ${TEMP_DIR}`);
  mkdirSync(TEMP_DIR, { recursive: true });

  const startTime = Date.now();

  // Step 1: CNAE reference
  await importCnaes();

  if (cnaeOnly) {
    console.log('\n✅ Importação CNAE concluída (--cnae-only).');
    return;
  }

  // Step 2: Municipios
  const municipiosMap = await loadMunicipios();

  // Step 3: Create temp table for Empresas
  console.log('\n═══ Etapa 2: Criando tabela temporária de empresas ═══');
  await execSQL(`
    DROP TABLE IF EXISTS _rf_empresa_temp;
    CREATE TABLE _rf_empresa_temp (
      cnpj_base VARCHAR(8) PRIMARY KEY,
      razao_social TEXT,
      porte TEXT,
      capital_social DOUBLE PRECISION
    );
  `);

  // Import Empresas batches
  const startBatch = specificBatch !== null ? specificBatch : 0;
  const endBatch = specificBatch !== null ? specificBatch + 1 : TOTAL_BATCHES;

  console.log('\n═══ Etapa 3: Importando Empresas (razão social, porte) ═══');
  for (let i = startBatch; i < endBatch; i++) {
    try {
      await importEmpresas(i);
    } catch (err) {
      console.error(`\n  ⚠️  Erro no batch Empresas${i}: ${err.message}`);
      console.error('     Continuando com o próximo batch...');
    }
  }

  // Step 4: Import Estabelecimentos
  console.log('\n═══ Etapa 4: Importando Estabelecimentos (CNAE, endereço, telefone) ═══');
  for (let i = startBatch; i < endBatch; i++) {
    try {
      await importEstabelecimentos(i, municipiosMap);
    } catch (err) {
      console.error(`\n  ⚠️  Erro no batch Estabelecimentos${i}: ${err.message}`);
      console.error('     Continuando com o próximo batch...');
    }
  }

  // Step 5: Cleanup temp table
  console.log('\n═══ Etapa 5: Limpeza ═══');
  await execSQL('DROP TABLE IF EXISTS _rf_empresa_temp');

  // Stats
  const countResult = await execSQL('SELECT COUNT(*) as total FROM "RfCompany"');
  const cnaeCountResult = await execSQL('SELECT COUNT(*) as total FROM "CnaeCode"');
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════');
  console.log(`✅ Importação concluída em ${elapsed} minutos!`);
  console.log(`   📊 ${cnaeCountResult.rows[0].total} códigos CNAE`);
  console.log(`   📊 ${Number(countResult.rows[0].total).toLocaleString('pt-BR')} empresas ativas (matrizes)`);
  console.log('═══════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err);
  process.exit(1);
});
