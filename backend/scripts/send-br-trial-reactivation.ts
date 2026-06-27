/**
 * Send BR trial reactivation promo emails to expired-trial workspace owners.
 *
 * **Dry-run by default** — no emails are sent unless you pass `--send`.
 *
 * Promo plan: `STARTER_PROMO_BR` (Starter/BASIC R$59/mo x 6 months).
 * Checkout link: `https://precisionia.com.br/checkout?promo=reactivation`
 *
 * Usage:
 *   # Count eligible users (default — dry-run)
 *   npx tsx backend/scripts/send-br-trial-reactivation.ts
 *
 *   # List recipients without sending
 *   npx tsx backend/scripts/send-br-trial-reactivation.ts --verbose
 *
 *   # Send to first 10 eligible users
 *   npx tsx backend/scripts/send-br-trial-reactivation.ts --send --limit=10
 *
 * Requires DATABASE_URL and email provider (Resend/SMTP) when using --send.
 * See backend/scripts/README-br-trial-reactivation.md for full runbook.
 */
import { runBrTrialReactivationCampaign } from '../src/lib/br-trial-reactivation';
import {
  buildReactivationPromoEmailHtml,
  getReactivationPromoEmailSubject,
} from '../src/lib/reactivation-promo-email';

function parseArgs(argv: string[]): { send: boolean; limit?: number; verbose: boolean } {
  if (argv.includes('--dry-run') && argv.includes('--send')) {
    throw new Error('Use either --dry-run or --send, not both');
  }
  const send = argv.includes('--send');
  const verbose = argv.includes('--verbose') || argv.includes('--dry-run') || !send;
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
  return { send, limit, verbose };
}

async function main(): Promise<void> {
  const { send, limit, verbose } = parseArgs(process.argv.slice(2));
  const dryRun = !send;

  console.log(`[br-trial-reactivation] mode=${dryRun ? 'dry-run' : 'send'} limit=${limit ?? 'none'}`);

  const result = await runBrTrialReactivationCampaign({ dryRun, limit });

  console.log(`[br-trial-reactivation] eligible recipients: ${result.eligible}`);

  if (result.eligible === 0) {
    console.log('[br-trial-reactivation] nothing to do');
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
    console.log(`[br-trial-reactivation] subject: ${getReactivationPromoEmailSubject()}`);
    console.log(`[br-trial-reactivation] preview HTML length: ${preview.length} chars`);
    console.log('[br-trial-reactivation] re-run with --send to deliver emails');
    return;
  }

  console.log(`[br-trial-reactivation] done sent=${result.sent} failed=${result.failed}`);
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('[br-trial-reactivation] fatal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
