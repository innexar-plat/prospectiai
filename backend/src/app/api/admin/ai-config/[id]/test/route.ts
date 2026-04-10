import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { createLanguageModel } from '@/lib/ai';
import { decryptApiKey } from '@/lib/ai/encrypt';
import { generateText } from 'ai';

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
        const model = createLanguageModel({
            provider: config.provider as 'GEMINI' | 'OPENAI' | 'CLOUDFLARE' | 'GROQ' | 'DEEPSEEK' | 'ANTHROPIC',
            model: config.model,
            apiKey,
            accountId: config.cloudflareAccountId ?? undefined,
        });
        await generateText({
            model,
            prompt: 'Respond with exactly: OK',
            maxTokens: 10,
        });
        logAdminAction(session, 'admin.ai-config.test', { resource: 'ai-config', resourceId: id }).catch(() => {});
        return NextResponse.json({ success: true });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config test error', { error: message });
        return NextResponse.json({ error: 'Test failed', details: message }, { status: 400 });
    }
}
