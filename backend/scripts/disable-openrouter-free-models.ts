/**
 * Disable slow/rate-limited OpenRouter :free models in AiProviderConfig.
 *
 * Use when analyses hang on meta-llama/llama-3.3-70b-instruct:free or other free-tier
 * duplicates while Cloudflare/Gemini are available.
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/disable-openrouter-free-models.ts
 *   npx ts-node --project backend/tsconfig.json backend/scripts/disable-openrouter-free-models.ts --dry-run
 *
 * Requires DATABASE_URL in env.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLOW_FREE_MODEL_PATTERNS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
    'mistralai/mistral-7b-instruct:free',
];

async function main(): Promise<void> {
    const dryRun = process.argv.includes('--dry-run');

    const configs = await prisma.aiProviderConfig.findMany({
        where: {
            provider: 'OPENROUTER',
            enabled: true,
            OR: [
                { model: { contains: ':free' } },
                { model: { in: SLOW_FREE_MODEL_PATTERNS } },
            ],
        },
        orderBy: [{ role: 'asc' }, { model: 'asc' }],
    });

    if (configs.length === 0) {
        console.log('No enabled OpenRouter :free configs found.');
        return;
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}Disabling ${configs.length} OpenRouter free config(s):`);
    for (const config of configs) {
        console.log(`  - ${config.id} ${config.role} ${config.model}`);
        if (!dryRun) {
            await prisma.aiProviderConfig.update({
                where: { id: config.id },
                data: { enabled: false },
            });
        }
    }

    if (dryRun) {
        console.log('Dry run complete. Re-run without --dry-run to apply.');
    } else {
        console.log('Done. Ensure CLOUDFLARE and/or GEMINI configs are enabled for lead_analysis and viability.');
    }
}

main()
    .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
