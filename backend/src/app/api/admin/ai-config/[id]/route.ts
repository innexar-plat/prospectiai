import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { aiConfigUpdateSchema, formatZodError } from '@/lib/validations/schemas';
import { encryptApiKey } from '@/lib/ai/encrypt';

const ROLE_TO_PRISMA = { lead_analysis: 'LEAD_ANALYSIS' as const, viability: 'VIABILITY' as const };

type AiConfigUpdatePayload = {
    role?: 'lead_analysis' | 'viability';
    provider?: 'GEMINI' | 'OPENAI' | 'CLOUDFLARE';
    model?: string;
    apiKey?: string | null;
    cloudflareAccountId?: string | null;
    enabled?: boolean;
};

function buildAiConfigUpdate(data: AiConfigUpdatePayload): {
    role?: 'LEAD_ANALYSIS' | 'VIABILITY';
    provider?: 'GEMINI' | 'OPENAI' | 'CLOUDFLARE';
    model?: string;
    apiKeyEncrypted?: string | null;
    cloudflareAccountId?: string | null;
    enabled?: boolean;
} {
    const update: ReturnType<typeof buildAiConfigUpdate> = {};
    if (data.role !== undefined) update.role = ROLE_TO_PRISMA[data.role];
    if (data.provider !== undefined) update.provider = data.provider;
    if (data.model !== undefined) update.model = data.model;
    if (data.enabled !== undefined) update.enabled = data.enabled;
    if (data.cloudflareAccountId !== undefined) update.cloudflareAccountId = data.cloudflareAccountId ?? null;
    if (data.apiKey !== undefined) update.apiKeyEncrypted = data.apiKey ? encryptApiKey(data.apiKey) : null;
    return update;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    try {
        const body = await req.json();
        const parsed = aiConfigUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const existing = await prisma.aiProviderConfig.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const update = buildAiConfigUpdate(parsed.data);

        const updated = await prisma.aiProviderConfig.update({
            where: { id },
            data: update,
        });
        logAdminAction(session, 'admin.ai-config.update', { resource: 'ai-config', resourceId: id }).catch(() => {});
        return NextResponse.json({
            id: updated.id,
            role: updated.role === 'LEAD_ANALYSIS' ? 'lead_analysis' : 'viability',
            provider: updated.provider,
            model: updated.model,
            enabled: updated.enabled,
            cloudflareAccountId: updated.cloudflareAccountId ?? undefined,
            hasApiKey: Boolean(updated.apiKeyEncrypted),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config update error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    try {
        const existing = await prisma.aiProviderConfig.findUnique({ where: { id } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        await prisma.aiProviderConfig.delete({ where: { id } });
        logAdminAction(session, 'admin.ai-config.delete', { resource: 'ai-config', resourceId: id }).catch(() => {});
        return NextResponse.json({ ok: true });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config delete error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
