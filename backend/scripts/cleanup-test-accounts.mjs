#!/usr/bin/env node
/**
 * Remove contas de teste/benchmark e opcionalmente migra FREE → TRIAL.
 *
 * Uso:
 *   node backend/scripts/cleanup-test-accounts.mjs --dry-run
 *   node backend/scripts/cleanup-test-accounts.mjs --execute
 *
 * Requer DATABASE_URL no ambiente (ou rodar via docker exec no backend).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_EMAIL_PATTERNS = [
  (email) => email.endsWith('@example.com'),
  (email) => /bench/i.test(email),
  (email) => /loadtest/i.test(email),
  (email) => /stress/i.test(email),
  (email) => email.startsWith('traefikbench'),
  (email) => email.startsWith('cfbench'),
];

function isTestEmail(email) {
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some((fn) => fn(email));
}

async function main() {
  const execute = process.argv.includes('--execute');
  const dryRun = !execute;

  console.log(dryRun ? '=== DRY RUN (use --execute para aplicar) ===' : '=== EXECUTING ===');

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, plan: true },
  });

  const testUsers = users.filter((u) => isTestEmail(u.email ?? ''));
  const realFreeUsers = users.filter(
    (u) => !isTestEmail(u.email ?? '') && u.plan === 'FREE',
  );

  console.log(`\nContas de teste encontradas: ${testUsers.length}`);
  testUsers.slice(0, 20).forEach((u) => console.log(`  - ${u.email}`));
  if (testUsers.length > 20) console.log(`  ... e mais ${testUsers.length - 20}`);

  console.log(`\nUsuários reais ainda em FREE: ${realFreeUsers.length}`);

  if (dryRun) {
    console.log('\nNenhuma alteração feita (dry-run).');
    return;
  }

  let deleted = 0;
  for (const user of testUsers) {
    await prisma.user.delete({ where: { id: user.id } });
    deleted++;
  }
  console.log(`\nDeletados: ${deleted} usuários de teste`);

  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const migratedWs = await prisma.workspace.updateMany({
    where: { plan: 'FREE' },
    data: {
      plan: 'TRIAL',
      leadsLimit: 50,
      subscriptionStatus: 'trialing',
      currentPeriodEnd: trialEnd,
    },
  });
  const migratedUsers = await prisma.user.updateMany({
    where: { plan: 'FREE' },
    data: { plan: 'TRIAL', leadsLimit: 50 },
  });

  await prisma.planConfig.updateMany({
    where: { key: 'FREE' },
    data: { isActive: false },
  });

  console.log(`Workspaces migrados FREE→TRIAL: ${migratedWs.count}`);
  console.log(`Users migrados FREE→TRIAL: ${migratedUsers.count}`);
  console.log('Plano FREE desativado no catálogo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
