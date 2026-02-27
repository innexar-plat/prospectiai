import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { webSearchConfigSchema, formatZodError } from '@/lib/validations/schemas';
import { encryptApiKey } from '@/lib/ai/encrypt';

const ROLE_TO_PRISMA = { lead_analysis: 'LEAD_ANALYSIS' as const, viability: 'VIABILITY' as const };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const configs = await prisma.webSearchConfig.findMany({
      orderBy: { role: 'asc' },
      select: {
        id: true,
        role: true,
        provider: true,
        maxResults: true,
        enabled: true,
        apiKeyEncrypted: true,
        updatedAt: true,
      },
    });
    const items = configs.map((c) => ({
      id: c.id,
      role: c.role === 'LEAD_ANALYSIS' ? 'lead_analysis' : 'viability',
      provider: c.provider,
      maxResults: c.maxResults,
      enabled: c.enabled,
      hasApiKey: Boolean(c.apiKeyEncrypted),
      updatedAt: c.updatedAt.toISOString(),
    }));
    logAdminAction(session, 'admin.web-search-config.list', { resource: 'web-search-config' }).catch(() => {});
    return NextResponse.json({ items });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin web-search-config list error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const parsed = webSearchConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    const { role, provider, apiKey, maxResults, enabled } = parsed.data;
    const prismaRole = ROLE_TO_PRISMA[role];
    const apiKeyEncrypted = apiKey ? encryptApiKey(apiKey) : undefined;

    const updated = await prisma.webSearchConfig.upsert({
      where: { role: prismaRole },
      create: {
        role: prismaRole,
        provider,
        apiKeyEncrypted: apiKeyEncrypted ?? null,
        maxResults: maxResults ?? 5,
        enabled,
      },
      update: {
        provider,
        maxResults: maxResults ?? 5,
        enabled,
        ...(apiKey !== undefined && { apiKeyEncrypted: apiKey ? encryptApiKey(apiKey) : null }),
      },
    });
    logAdminAction(session, 'admin.web-search-config.upsert', {
      resource: 'web-search-config',
      resourceId: updated.id,
      details: { role: updated.role },
    }).catch(() => {});
    return NextResponse.json({
      id: updated.id,
      role: updated.role === 'LEAD_ANALYSIS' ? 'lead_analysis' : 'viability',
      provider: updated.provider,
      maxResults: updated.maxResults,
      enabled: updated.enabled,
      hasApiKey: Boolean(updated.apiKeyEncrypted),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin web-search-config upsert error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
