#!/usr/bin/env node

/**
 * Lightweight load test script for /api/search and /api/v1/search using native fetch.
 *
 * Usage example:
 * SEARCH_BASE_URL=http://localhost:4000 \
 * SEARCH_PATH=/api/search \
 * SEARCH_COOKIE="next-auth.session-token=..." \
 * node scripts/load-search.mjs
 */

import { performance } from 'node:perf_hooks';

const baseUrl = process.env.SEARCH_BASE_URL ?? 'http://localhost:4000';
const path = process.env.SEARCH_PATH ?? '/api/search';
const totalRequests = Number.parseInt(process.env.SEARCH_TOTAL_REQUESTS ?? '500', 10);
const concurrency = Number.parseInt(process.env.SEARCH_CONCURRENCY ?? '25', 10);
const timeoutMs = Number.parseInt(process.env.SEARCH_TIMEOUT_MS ?? '15000', 10);
const cookie = process.env.SEARCH_COOKIE ?? '';
const query = process.env.SEARCH_QUERY ?? 'restaurantes sao paulo';

const target = `${baseUrl}${path}`;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function runOne() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ textQuery: query, pageSize: 20 }),
      signal: controller.signal,
    });
    const elapsed = performance.now() - started;
    return { ok: res.ok, status: res.status, elapsed };
  } catch {
    const elapsed = performance.now() - started;
    return { ok: false, status: 0, elapsed };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const started = performance.now();
  const latencies = [];
  let sent = 0;
  let success = 0;
  let failed = 0;
  const byStatus = new Map();

  async function worker() {
    while (true) {
      const current = sent;
      sent += 1;
      if (current >= totalRequests) return;

      const r = await runOne();
      latencies.push(r.elapsed);
      if (r.ok) success += 1;
      else failed += 1;
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const totalElapsedSec = (performance.now() - started) / 1000;
  const rps = totalRequests / Math.max(totalElapsedSec, 0.001);

  console.log('=== Search Load Test Result ===');
  console.log(`target: ${target}`);
  console.log(`requests: ${totalRequests}`);
  console.log(`concurrency: ${concurrency}`);
  console.log(`success: ${success}`);
  console.log(`failed: ${failed}`);
  console.log(`durationSec: ${totalElapsedSec.toFixed(2)}`);
  console.log(`rps: ${rps.toFixed(2)}`);
  console.log(`latencyMs p50: ${percentile(latencies, 50).toFixed(2)}`);
  console.log(`latencyMs p95: ${percentile(latencies, 95).toFixed(2)}`);
  console.log(`latencyMs p99: ${percentile(latencies, 99).toFixed(2)}`);
  console.log(`latencyMs max: ${percentile(latencies, 100).toFixed(2)}`);
  console.log(`statusCounts: ${JSON.stringify(Object.fromEntries(byStatus.entries()))}`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('load test failed', err);
  process.exit(1);
});
