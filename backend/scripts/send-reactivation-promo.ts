/**
 * Send BR trial reactivation promo emails (alias for send-br-trial-reactivation).
 *
 * Dry-run by default. Pass `--send` to deliver emails.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/send-reactivation-promo.ts --dry-run
 *   npx ts-node --project backend/tsconfig.json backend/scripts/send-reactivation-promo.ts --dry-run --limit=10
 *   npx ts-node --project backend/tsconfig.json backend/scripts/send-reactivation-promo.ts --send --limit=5
 */
import { runBrTrialReactivationCampaign } from '../src/lib/br-trial-reactivation';
import {
  buildReactivationPromoEmailHtml,
  getReactivationPromoEmailSubject,
} from '../src/lib/reactivation-promo-email';

function parseArgs(argv: string[]): { dryRun: boolean; limit?: number; verbose: boolean } {
  if (argv.includes('--dry-run') && argv.includes('--send')) {
    throw new Error('Use either --dry-run or --send, not both');
  }
  const dryRun = argv.includes('--dry-run') || !argv.includes('--send');
  const verbose = argv.includes('--verbose') || dryRun;
  const limitFlag = argv.find((a) => a.startsWith('--limit'));
  let limit: number | undefined;
  if (limitFlag) {
    const raw = limitFlag.includes('=') ? limitFlag.split('=')[1] : argv[argv.indexOf(limitFlag) + 1];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error('Invalid --limit value (expected positive integer)');
    }
    limit = Math.floor(parsed);
  }
  return { dryRun, limit, verbose };
}

async function main(): Promise<void> {
  const { dryRun, limit, verbose } = parseArgs(process.argv.slice(2));

  console.log(`[reactivation-promo] mode=${dryRun ? 'dry-run' : 'send'} limit=${limit ?? 'none'}`);

  const result = await runBrTrialReactivationCampaign({ dryRun, limit });

  console.log(`[reactivation-promo] eligible recipients: ${result.eligible}`);

  if (result.eligible === 0) {
    console.log('[reactivation-promo] nothing to do');
    return;
  }

  if (dryRun) {
    if (verbose) {
      result.recipients.forEach((r, i) => {
        const firstName = r.name?.split(/\s/)[0] ?? '(sem nome)';
        console.log(`  ${i + 1}. ${r.email} — ${firstName} (workspace ${r.workspaceId})`);
      });
    }
    const preview = buildReactivationPromoEmailHtml({
      userName: result.recipients[0]?.name?.split(/\s/)[0],
    });
    console.log(`[reactivation-promo] subject: ${getReactivationPromoEmailSubject()}`);
    console.log(`[reactivation-promo] preview HTML length: ${preview.length} chars`);
    console.log('[reactivation-promo] re-run with --send to deliver emails');
    return;
  }

  console.log(`[reactivation-promo] done sent=${result.sent} failed=${result.failed}`);
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[reactivation-promo] fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
