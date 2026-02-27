import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { aiConfigCreateSchema, formatZodError } from '@/lib/validations/schemas';
import { encryptApiKey } from '@/lib/ai/encrypt';

const ROLE_TO_PRISMA = { lead_analysis: 'LEAD_ANALYSIS' as const, viability: 'VIABILITY' as const };

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const configs = await prisma.aiProviderConfig.findMany({
            orderBy: [{ role: 'asc' }, { updatedAt: 'desc' }],
            select: {
                id: true,
                role: true,
                provider: true,
                model: true,
                enabled: true,
                cloudflareAccountId: true,
                createdAt: true,
                updatedAt: true,
                apiKeyEncrypted: true,
            },
        });
        const items = configs.map((c) => ({
            id: c.id,
            role: c.role === 'LEAD_ANALYSIS' ? 'lead_analysis' : 'viability',
            provider: c.provider,
            model: c.model,
            enabled: c.enabled,
            cloudflareAccountId: c.cloudflareAccountId ?? undefined,
            hasApiKey: Boolean(c.apiKeyEncrypted),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }));
        void logAdminAction(session, 'admin.ai-config.list', { resource: 'ai-config' });
        return NextResponse.json({ items });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config list error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const body = await req.json();
        const parsed = aiConfigCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        const { role, provider, model, apiKey, cloudflareAccountId, enabled } = parsed.data;
        const apiKeyEncrypted = apiKey ? encryptApiKey(apiKey) : null;
        const created = await prisma.aiProviderConfig.create({
            data: {
                role: ROLE_TO_PRISMA[role],
                provider,
                model,
                apiKeyEncrypted,
                cloudflareAccountId: cloudflareAccountId ?? null,
                enabled,
            },
        });
        void logAdminAction(session, 'admin.ai-config.create', {
            resource: 'ai-config',
            resourceId: created.id,
            details: { role: created.role, provider: created.provider },
        });
        return NextResponse.json({
            id: created.id,
            role: created.role === 'LEAD_ANALYSIS' ? 'lead_analysis' : 'viability',
            provider: created.provider,
            model: created.model,
            enabled: created.enabled,
            cloudflareAccountId: created.cloudflareAccountId ?? undefined,
            hasApiKey: Boolean(created.apiKeyEncrypted),
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
        });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error('Admin ai-config create error', { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
