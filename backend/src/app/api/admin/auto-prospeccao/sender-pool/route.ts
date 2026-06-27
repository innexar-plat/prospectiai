import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import { encryptEmailSecret } from '@/lib/email-config-encrypt';
import { z } from 'zod';

const createSchema = z.object({
  workspaceId: z.string().min(1),
  label: z.string().min(1).max(100),
  provider: z.enum(['resend', 'smtp']),
  fromEmail: z.string().min(1).max(500),
  isActive: z.boolean().optional().default(true),
  dailyLimit: z.number().int().min(1).max(10000).optional().default(200),
  // Resend
  apiKey: z.string().optional(),
  // SMTP
  smtpHost: z.string().optional().nullable(),
  smtpPort: z
    .union([z.number().int().min(1).max(65535), z.string().regex(/^\d+$/).transform(Number)])
    .optional()
    .nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional(),
});

function toPublic(row: {
  id: string; workspaceId: string; label: string; provider: string; fromEmail: string;
  isActive: boolean; dailyLimit: number; sentToday: number; lastUsedAt: Date | null;
  resendApiKeyEncrypted: string | null; smtpHost: string | null; smtpPort: number | null;
  smtpUser: string | null; smtpPasswordEncrypted: string | null;
  createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    label: row.label,
    provider: row.provider,
    fromEmail: row.fromEmail,
    isActive: row.isActive,
    dailyLimit: row.dailyLimit,
    sentToday: row.sentToday,
    lastUsedAt: row.lastUsedAt,
    hasApiKey: Boolean(row.resendApiKeyEncrypted),
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpUser: row.smtpUser,
    hasSmtpPassword: Boolean(row.smtpPasswordEncrypted),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * GET /api/admin/auto-prospeccao/sender-pool?workspaceId=
 * List all senders in workspace pool.
 */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = new URL(req.url).searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  const rows = await prisma.autoProspSenderPool.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ data: rows.map(toPublic) });
}

/**
 * POST /api/admin/auto-prospeccao/sender-pool
 * Create a new sender in the workspace pool.
 */
export async function POST(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join('; ') }, { status: 400 });
  }

  const d = parsed.data;

  // Validate credentials based on provider
  if (d.provider === 'resend' && !d.apiKey) {
    return NextResponse.json({ error: 'apiKey required for Resend provider' }, { status: 400 });
  }
  if (d.provider === 'smtp') {
    if (!d.smtpHost || !d.smtpPort || !d.smtpUser || !d.smtpPassword) {
      return NextResponse.json({ error: 'smtpHost, smtpPort, smtpUser and smtpPassword required for SMTP provider' }, { status: 400 });
    }
  }

  const created = await prisma.autoProspSenderPool.create({
    data: {
      workspaceId: d.workspaceId,
      label: d.label,
      provider: d.provider,
      fromEmail: d.fromEmail,
      isActive: d.isActive,
      dailyLimit: d.dailyLimit,
      resendApiKeyEncrypted: d.apiKey ? encryptEmailSecret(d.apiKey) : null,
      smtpHost: d.smtpHost ?? null,
      smtpPort: d.smtpPort ?? null,
      smtpUser: d.smtpUser ?? null,
      smtpPasswordEncrypted: d.smtpPassword ? encryptEmailSecret(d.smtpPassword) : null,
    },
  });

  return NextResponse.json({ data: toPublic(created) }, { status: 201 });
}
