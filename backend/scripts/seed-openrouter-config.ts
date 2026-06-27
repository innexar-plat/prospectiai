/**
 * One-off: insert OpenRouter AI provider configs (encrypted API key in DB).
 *
 * NOTE: OpenRouter :free models are low priority (after CLOUDFLARE/GEMINI). They may be
 * slow (10+ min) or rate limited. Prefer Cloudflare/Gemini as primary providers.
 * To disable free models: backend/scripts/disable-openrouter-free-models.ts
 *
 * Usage (API key via env — never commit):
 *   OPENROUTER_API_KEY='sk-or-v1-...' npx ts-node --project backend/tsconfig.json backend/scripts/seed-openrouter-config.ts
 *
 * Requires DATABASE_URL and AUTH_SECRET (or AI_CONFIG_ENCRYPTION_KEY) in env.
 */
import { PrismaClient, AiConfigRole, AiConfigProvider } from '@prisma/client';
import { encryptApiKey } from '../src/lib/ai/encrypt';

const prisma = new PrismaClient();

type SeedEntry = {
    role: AiConfigRole;
    model: string;
};

const ENTRIES: SeedEntry[] = [
    { role: 'LEAD_ANALYSIS', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { role: 'LEAD_ANALYSIS', model: 'google/gemma-2-9b-it:free' },
    { role: 'LEAD_ANALYSIS', model: 'meta-llama/llama-3.2-3b-instruct:free' },
    { role: 'VIABILITY', model: 'meta-llama/llama-3.2-3b-instruct:free' },
    { role: 'VIABILITY', model: 'mistralai/mistral-7b-instruct:free' },
];

async function main(): Promise<void> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY env var is required');
    }

    const apiKeyEncrypted = encryptApiKey(apiKey);
    const provider: AiConfigProvider = 'OPENROUTER';

    for (const entry of ENTRIES) {
        const existing = await prisma.aiProviderConfig.findFirst({
            where: { role: entry.role, provider, model: entry.model },
        });

        if (existing) {
            const updated = await prisma.aiProviderConfig.update({
                where: { id: existing.id },
                data: { apiKeyEncrypted, enabled: true },
            });
            console.log(`updated ${updated.id} ${entry.role} ${entry.model}`);
        } else {
            const created = await prisma.aiProviderConfig.create({
                data: {
                    role: entry.role,
                    provider,
                    model: entry.model,
                    apiKeyEncrypted,
                    enabled: true,
                },
            });
            console.log(`created ${created.id} ${entry.role} ${entry.model}`);
        }
    }
}

main()
    .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
