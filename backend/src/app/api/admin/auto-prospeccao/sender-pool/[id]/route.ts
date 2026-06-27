import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import { encryptEmailSecret, decryptEmailSecret } from '@/lib/email-config-encrypt';
import { z } from 'zod';

const patchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  provider: z.enum(['resend', 'smtp']).optional(),
  fromEmail: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
  dailyLimit: z.number().int().min(1).max(10000).optional(),
  apiKey: z.string().optional(),
  smtpHost: z.string().optional().nullable(),
  smtpPort: z
    .union([z.number().int().min(1).max(65535), z.string().regex(/^\d+$/).transform(Number)])
    .optional()
    .nullable(),
  smtpUser: z.string().optional().nullable(),
  smtpPassword: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

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
 * PATCH /api/admin/auto-prospeccao/sender-pool/[id]
 * Update a sender pool entry. Only provided fields are updated.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join('; ') }, { status: 400 });
  }

  const existing = await prisma.autoProspSenderPool.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const d = parsed.data;
  const data: Record<string, unknown> = {};

  if (d.label !== undefined) data.label = d.label;
  if (d.provider !== undefined) data.provider = d.provider;
  if (d.fromEmail !== undefined) data.fromEmail = d.fromEmail;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.dailyLimit !== undefined) data.dailyLimit = d.dailyLimit;

  // Handle credential updates (keep existing if not provided)
  const provider = (d.provider ?? existing.provider) as 'resend' | 'smtp';
  if (provider === 'resend') {
    data.resendApiKeyEncrypted = d.apiKey ? encryptEmailSecret(d.apiKey) : existing.resendApiKeyEncrypted;
    data.smtpHost = null;
    data.smtpPort = null;
    data.smtpUser = null;
    data.smtpPasswordEncrypted = null;
  } else {
    data.smtpHost = d.smtpHost !== undefined ? d.smtpHost : existing.smtpHost;
    data.smtpPort = d.smtpPort !== undefined ? d.smtpPort : existing.smtpPort;
    data.smtpUser = d.smtpUser !== undefined ? d.smtpUser : existing.smtpUser;
    data.smtpPasswordEncrypted = d.smtpPassword ? encryptEmailSecret(d.smtpPassword) : existing.smtpPasswordEncrypted;
    data.resendApiKeyEncrypted = null;
  }

  const updated = await prisma.autoProspSenderPool.update({ where: { id }, data });
  return NextResponse.json({ data: toPublic(updated) });
}

/**
 * DELETE /api/admin/auto-prospeccao/sender-pool/[id]
 * Remove a sender from the pool.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await prisma.autoProspSenderPool.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.autoProspSenderPool.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
