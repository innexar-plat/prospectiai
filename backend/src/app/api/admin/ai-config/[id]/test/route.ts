import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { createGeminiAdapter } from '@/lib/ai/adapters/gemini';
import { createOpenAIAdapter } from '@/lib/ai/adapters/openai';
import { createCloudflareAdapter } from '@/lib/ai/adapters/cloudflare';
import { decryptApiKey } from '@/lib/ai/encrypt';

/**
 * POST /api/admin/ai-config/[id]/test — test this config with a simple completion.
 * Does not expose the API key; returns success or error message.
 */
export async function POST(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    try {
        const config = await prisma.aiProviderConfig.findUnique({ where: { id } });
        if (!config) return NextResponse.json({ error: 'Config not found' }, { status: 404 });
        if (!config.apiKeyEncrypted) {
            return NextResponse.json({ error: 'No API key configured for this config' }, { status: 400 });
        }
        const apiKey = decryptApiKey(config.apiKeyEncrypted);
        const adapter =
            config.provider === 'GEMINI'
                ? createGeminiAdapter(apiKey, config.model)
                : config.provider === 'OPENAI'
                  ? createOpenAIAdapter(apiKey, config.model)
                  : createCloudflareAdapter(apiKey, config.model, config.cloudflareAccountId ?? undefined);
        await adapter.generateCompletion({
            prompt: 'Respond with exactly: OK',
            maxTokens: 10,
        });
        void logAdminAction(session, 'admin.ai-config.test', { resource: 'ai-config', resourceId: id });
        return NextResponse.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config test error', { error: message });
        return NextResponse.json({ error: 'Test failed', details: message }, { status: 400 });
    }
}
