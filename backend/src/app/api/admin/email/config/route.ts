import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { encryptEmailSecret } from '@/lib/email-config-encrypt';
import { z } from 'zod';

const patchSchema = z.object({
  provider: z.enum(['resend', 'smtp']),
  apiKey: z.string().optional(),
  // Aceita "email@domain.com" ou "Nome <email@domain.com>" (From header)
  fromEmail: z.string().max(500).optional().nullable(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z
    .union([z.number().int().min(1).max(65535), z.string().regex(/^\d+$/).transform(Number)])
    .optional()
    .nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional(),
});

export type EmailConfigPublic = {
  configured: boolean;
  provider?: 'resend' | 'smtp';
  fromEmail?: string | null;
  hasResendApiKey?: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
};

type EmailConfigRow = {
  id: string;
  provider: string;
  resendApiKeyEncrypted: string | null;
  fromEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswordEncrypted: string | null;
};

function toEmailConfigPublic(row: EmailConfigRow | null): EmailConfigPublic {
  if (!row) {
    return {
      configured: false,
      provider: undefined,
      fromEmail: undefined,
      hasResendApiKey: false,
      smtpHost: undefined,
      smtpPort: undefined,
      smtpUser: undefined,
    };
  }
  const configured =
    (row.provider === 'resend' && Boolean(row.resendApiKeyEncrypted)) ||
    (row.provider === 'smtp' &&
      Boolean(row.smtpHost && row.smtpPort && row.smtpUser && row.smtpPasswordEncrypted));
  return {
    configured,
    provider: row.provider as 'resend' | 'smtp',
    fromEmail: row.fromEmail,
    hasResendApiKey: Boolean(row.resendApiKeyEncrypted),
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
  };
}

function buildEmailConfigUpdateData(
  provider: 'resend' | 'smtp',
  payload: { apiKey?: string; fromEmail?: string | null; smtpHost?: string | null; smtpPort?: number | null; smtpUser?: string | null; smtpPassword?: string },
  existing: EmailConfigRow | null,
): {
  provider: string;
  resendApiKeyEncrypted: string | null;
  fromEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswordEncrypted: string | null;
} {
  const data = {
    provider,
    resendApiKeyEncrypted: null as string | null,
    fromEmail: payload.fromEmail ?? null,
    smtpHost: null as string | null,
    smtpPort: null as number | null,
    smtpUser: null as string | null,
    smtpPasswordEncrypted: null as string | null,
  };
  if (provider === 'resend') {
    data.resendApiKeyEncrypted = payload.apiKey ? encryptEmailSecret(payload.apiKey) : existing?.resendApiKeyEncrypted ?? null;
  } else {
    data.smtpHost = payload.smtpHost ?? null;
    data.smtpPort = payload.smtpPort ?? null;
    data.smtpUser = payload.smtpUser ?? null;
    data.smtpPasswordEncrypted = payload.smtpPassword ? encryptEmailSecret(payload.smtpPassword) : existing?.smtpPasswordEncrypted ?? null;
  }
  return data;
}

/**
 * GET /api/admin/email/config
 * Returns email config without secrets. Admin only.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const row = await prisma.emailConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    return NextResponse.json(toEmailConfigPublic(row));
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin email config GET error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/email/config
 * Create or update email config. Secrets encrypted. Admin only.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join('; ');
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const existing = await prisma.emailConfig.findFirst({ orderBy: { updatedAt: 'desc' } }) as EmailConfigRow | null;
    const data = buildEmailConfigUpdateData(parsed.data.provider, parsed.data, existing);

    const updated = existing
      ? await prisma.emailConfig.update({ where: { id: existing.id }, data })
      : await prisma.emailConfig.create({ data });

    return NextResponse.json(toEmailConfigPublic(updated as EmailConfigRow));
  } catch (e) {
    const { logger } = await import('@/lib/logger');
    logger.error('Admin email config PATCH error', { error: e instanceof Error ? e.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
