import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { aiConfigUpdateSchema, formatZodError } from '@/lib/validations/schemas';
import { encryptApiKey } from '@/lib/ai/encrypt';

const ROLE_TO_PRISMA = { lead_analysis: 'LEAD_ANALYSIS' as const, viability: 'VIABILITY' as const };

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

        const update: {
            role?: 'LEAD_ANALYSIS' | 'VIABILITY';
            provider?: 'GEMINI' | 'OPENAI' | 'CLOUDFLARE';
            model?: string;
            apiKeyEncrypted?: string | null;
            cloudflareAccountId?: string | null;
            enabled?: boolean;
        } = {};
        if (parsed.data.role !== undefined) update.role = ROLE_TO_PRISMA[parsed.data.role];
        if (parsed.data.provider !== undefined) update.provider = parsed.data.provider;
        if (parsed.data.model !== undefined) update.model = parsed.data.model;
        if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
        if (parsed.data.cloudflareAccountId !== undefined) update.cloudflareAccountId = parsed.data.cloudflareAccountId ?? null;
        if (parsed.data.apiKey !== undefined) {
            update.apiKeyEncrypted = parsed.data.apiKey ? encryptApiKey(parsed.data.apiKey) : null;
        }

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
