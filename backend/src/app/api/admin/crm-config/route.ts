import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { encryptEmailSecret } from '@/lib/email-config-encrypt';

const patchSchema = z.object({
  provider: z.enum(['rdstation', 'agendor', 'hubspot']),
  clientId: z.string().min(3, 'Client ID inválido'),
  clientSecret: z.string().min(3, 'Client Secret inválido').optional(),
});

const providerQuerySchema = z.object({
  provider: z.enum(['rdstation', 'agendor', 'hubspot']).default('rdstation'),
});

type CrmConfigPublic = {
  configured: boolean;
  provider: 'rdstation' | 'agendor' | 'hubspot';
  clientId: string;
  hasClientSecret: boolean;
};

type CrmConfigRow = {
  id: string;
  provider: string;
  clientId: string;
  clientSecretEncrypted: string;
};

function toPublic(row: CrmConfigRow | null, provider: 'rdstation' | 'agendor' | 'hubspot'): CrmConfigPublic {
  return {
    configured: Boolean(row?.clientId && row?.clientSecretEncrypted),
    provider,
    clientId: row?.clientId ?? '',
    hasClientSecret: Boolean(row?.clientSecretEncrypted),
  };
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const parsedQuery = providerQuerySchema.safeParse({ provider: req.nextUrl.searchParams.get('provider') ?? undefined });
    const provider = parsedQuery.success ? parsedQuery.data.provider : 'rdstation';
    const row = await prisma.crmIntegrationConfig.findUnique({ where: { provider } }) as CrmConfigRow | null;
    return NextResponse.json(toPublic(row, provider));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin CRM config GET error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const existing = await prisma.crmIntegrationConfig.findUnique({ where: { provider: parsed.data.provider } }) as CrmConfigRow | null;
    const clientSecretEncrypted = parsed.data.clientSecret
      ? encryptEmailSecret(parsed.data.clientSecret)
      : existing?.clientSecretEncrypted;

    if (!clientSecretEncrypted) {
      return NextResponse.json({ error: 'Informe o Client Secret ao menos na primeira configuração.' }, { status: 400 });
    }

    const data = {
      provider: parsed.data.provider,
      clientId: parsed.data.clientId.trim(),
      clientSecretEncrypted,
    };

    const updated = existing
      ? await prisma.crmIntegrationConfig.update({ where: { id: existing.id }, data })
      : await prisma.crmIntegrationConfig.create({ data });

    return NextResponse.json(toPublic(updated as CrmConfigRow, parsed.data.provider));
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin CRM config PATCH error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}