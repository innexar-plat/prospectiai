#!/usr/bin/env node
/**
 * Seed CnaeCode table from IBGE API (subclasses endpoint).
 * Usage: node backend/scripts/seed-cnae-ibge.mjs
 */
import pg from 'pg';
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://prospector:B2rzQ3wXdobIFSBDjgx48aC7D5tQVWuqLWc83H4R@localhost:5434/prospector_db';

const IBGE_URL = 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses';

async function main() {
  console.log('Fetching CNAE subclasses from IBGE API...');
  const res = await fetch(IBGE_URL);
  if (!res.ok) throw new Error(`IBGE API returned ${res.status}`);
  const data = await res.json();
  console.log(`Fetched ${data.length} CNAE subclasses`);

  // Map to {code, description} — code is the 7-digit id, description is the subclass descricao
  const records = data.map(item => ({
    code: item.id,
    description: item.descricao,
  }));

  const client = new Client(DB_URL);
  await client.connect();

  // Batch insert in chunks of 500
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const chunk = records.slice(i, i + BATCH);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const off = idx * 2;
      values.push(`($${off + 1}, $${off + 2})`);
      params.push(r.code, r.description);
    });
    await client.query(
      `INSERT INTO "CnaeCode" (code, description) VALUES ${values.join(',')}
       ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description`,
      params
    );
    inserted += chunk.length;
    process.stdout.write(`\r  Inserted ${inserted}/${records.length}`);
  }
  console.log('\nDone!');

  // Quick check
  const countRes = await client.query('SELECT count(*) FROM "CnaeCode"');
  console.log(`Total CnaeCode rows: ${countRes.rows[0].count}`);

  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
