/**
 * Force-expire active TRIAL workspaces (admin / one-off).
 *
 * Aligns with runTrialExpiryJob() in src/lib/trial.ts:
 * - Keeps plan TRIAL
 * - Sets subscriptionStatus to trial_expired
 * - Sets currentPeriodEnd to now - 1 day
 * - Sets starterPromoEligible true
 * - Does NOT zero leadsLimit (product blocks usage via TRIAL_EXPIRED)
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node --project tsconfig.json scripts/expire-all-trials.ts
 *   ... --market BR          (default)
 *   ... --all-markets
 *   ... --execute            (default is dry-run)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRIAL_STATUS = 'trialing';
const TRIAL_EXPIRED_STATUS = 'trial_expired';
const PAID_PLANS = new Set(['BASIC', 'PRO', 'BUSINESS', 'SCALE']);

type Args = {
  execute: boolean;
  allMarkets: boolean;
  market: 'BR' | 'US';
};

type WorkspaceRow = {
  id: string;
  name: string | null;
  plan: string;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  leadsLimit: number;
  leadsUsed: number;
  subscriptionId: string | null;
  billingCycle: string | null;
  cnpj: string | null;
};

function parseArgs(argv: string[]): Args {
  const execute = argv.includes('--execute');
  const allMarkets = argv.includes('--all-markets');
  const marketFlag = argv.find((a) => a.startsWith('--market'));
  let market: 'BR' | 'US' = 'BR';
  if (marketFlag) {
    const raw = marketFlag.includes('=')
      ? marketFlag.split('=')[1]
      : argv[argv.indexOf(marketFlag) + 1];
    if (raw !== 'BR' && raw !== 'US') {
      throw new Error('Invalid --market (use BR or US)');
    }
    market = raw;
  }
  return { execute, allMarkets, market };
}

/** Mirrors classifyWorkspaceMarket() in src/lib/admin-market-stats.ts */
function classifyWorkspaceMarket(workspace: WorkspaceRow): 'BR' | 'US' {
  if (workspace.subscriptionId != null && workspace.subscriptionId.startsWith('sub_')) {
    return 'US';
  }
  const isPaidPlan = PAID_PLANS.has(workspace.plan);
  const isActivePaid =
    isPaidPlan &&
    workspace.subscriptionStatus != null &&
    (workspace.subscriptionStatus === 'active' || workspace.subscriptionStatus === TRIAL_STATUS);
  if (isActivePaid) return 'BR';
  if (workspace.plan === 'TRIAL') return 'BR';
  const status = workspace.subscriptionStatus ?? '';
  if (status === TRIAL_STATUS || status === TRIAL_EXPIRED_STATUS) return 'BR';
  if (workspace.cnpj != null && workspace.cnpj.trim() !== '') return 'BR';
  if (
    workspace.plan === 'FREE' &&
    workspace.leadsLimit <= 0 &&
    (workspace.subscriptionStatus == null || workspace.subscriptionStatus === 'inactive')
  ) {
    return 'US';
  }
  return 'BR';
}

function isActiveTrial(workspace: WorkspaceRow): boolean {
  if (workspace.plan !== 'TRIAL') return false;
  if (workspace.subscriptionStatus === TRIAL_EXPIRED_STATUS) return false;
  if (workspace.subscriptionStatus === TRIAL_STATUS) return true;
  return workspace.subscriptionStatus == null;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const forcedEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(
    `[expire-all-trials] dryRun=${!args.execute} market=${args.allMarkets ? 'ALL' : args.market} forcedEnd=${forcedEnd.toISOString()}`,
  );

  const candidates = await prisma.workspace.findMany({
    where: {
      plan: 'TRIAL',
      OR: [{ subscriptionStatus: TRIAL_STATUS }, { subscriptionStatus: null }],
    },
    select: {
      id: true,
      name: true,
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      leadsLimit: true,
      leadsUsed: true,
      subscriptionId: true,
      billingCycle: true,
      cnpj: true,
    },
  });

  const active = candidates.filter(isActiveTrial);
  const filtered = args.allMarkets
    ? active
    : active.filter((w) => classifyWorkspaceMarket(w) === args.market);

  const alreadyExpired = await prisma.workspace.count({
    where: { plan: 'TRIAL', subscriptionStatus: TRIAL_EXPIRED_STATUS },
  });

  console.log(`[expire-all-trials] candidates (active trial): ${active.length}`);
  console.log(`[expire-all-trials] to update (after market filter): ${filtered.length}`);
  console.log(`[expire-all-trials] already trial_expired in DB: ${alreadyExpired}`);

  if (filtered.length > 0) {
    const sample = filtered.slice(0, 5);
    for (const w of sample) {
      console.log(
        `  sample id=${w.id} status=${w.subscriptionStatus} end=${w.currentPeriodEnd?.toISOString() ?? 'null'} market=${classifyWorkspaceMarket(w)}`,
      );
    }
    if (filtered.length > 5) {
      console.log(`  ... and ${filtered.length - 5} more`);
    }
  }

  if (!args.execute) {
    console.log('[expire-all-trials] dry-run only — pass --execute to apply');
    return;
  }

  if (filtered.length === 0) {
    console.log('[expire-all-trials] nothing to update');
    return;
  }

  const ids = filtered.map((w) => w.id);
  const baseData = {
    subscriptionStatus: TRIAL_EXPIRED_STATUS,
    currentPeriodEnd: forcedEnd,
  };

  let result;
  try {
    result = await prisma.workspace.updateMany({
      where: { id: { in: ids } },
      data: { ...baseData, starterPromoEligible: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('starterPromoEligible')) throw err;
    console.warn('[expire-all-trials] starterPromoEligible column missing — updating without it');
    result = await prisma.workspace.updateMany({
      where: { id: { in: ids } },
      data: baseData,
    });
  }

  const afterExpired = await prisma.workspace.count({
    where: { plan: 'TRIAL', subscriptionStatus: TRIAL_EXPIRED_STATUS },
  });
  const afterTrialing = await prisma.workspace.count({
    where: { plan: 'TRIAL', subscriptionStatus: TRIAL_STATUS },
  });

  console.log(`[expire-all-trials] updated rows: ${result.count}`);
  console.log(`[expire-all-trials] after — trialing: ${afterTrialing}, trial_expired: ${afterExpired}`);
}

main()
  .catch((err) => {
    console.error('[expire-all-trials] fatal:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
