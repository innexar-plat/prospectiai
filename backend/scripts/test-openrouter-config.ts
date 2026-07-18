/**
 * Smoke-test OpenRouter DB configs (decrypt + generateText).
 *
 * Usage:
 *   npx ts-node --project backend/tsconfig.json backend/scripts/test-openrouter-config.ts [configId]
 */
import { PrismaClient } from '@prisma/client';
import { generateText } from 'ai';
import { createLanguageModel } from '../src/lib/ai/resolve';
import { decryptApiKey } from '../src/lib/ai/encrypt';

const prisma = new PrismaClient();

async function testConfig(id: string): Promise<void> {
    const config = await prisma.aiProviderConfig.findUnique({ where: { id } });
    if (!config) throw new Error(`Config not found: ${id}`);
    if (!config.apiKeyEncrypted) throw new Error('No API key on config');

    const apiKey = decryptApiKey(config.apiKeyEncrypted);
    const model = createLanguageModel({
        provider: config.provider as 'OPENROUTER',
        model: config.model,
        apiKey,
    });

    const result = await generateText({
        model,
        prompt: 'Respond with exactly: OK',
        maxOutputTokens: 10,
    });

    console.log(JSON.stringify({
        id,
        provider: config.provider,
        model: config.model,
        role: config.role,
        text: result.text?.trim(),
        success: true,
    }));
}

async function main(): Promise<void> {
    const idArg = process.argv[2];
    if (idArg) {
        await testConfig(idArg);
        return;
    }

    const configs = await prisma.aiProviderConfig.findMany({
        where: { provider: 'OPENROUTER', enabled: true },
        orderBy: [{ role: 'asc' }, { model: 'asc' }],
        take: 1,
    });

    if (configs.length === 0) {
        throw new Error('No OPENROUTER configs found in DB');
    }

    await testConfig(configs[0]!.id);
}

main()
    .catch((err) => {
        console.error(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }));
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
