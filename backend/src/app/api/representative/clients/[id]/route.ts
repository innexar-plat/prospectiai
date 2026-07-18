import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { REP_CLIENT_STATUSES } from '@/lib/rep-client-status';
import { z } from 'zod';
import { getMarketConfig, type Market } from '@/lib/market';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  planId: z.string().max(100).optional().nullable(),
  valueCents: z.number().int().min(0).optional().nullable(),
  status: z.enum(REP_CLIENT_STATUSES).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

async function getOwnedClient(clientId: string, userId: string) {
  const rep = await prisma.representative.findUnique({
    where: { userId },
    select: { id: true, workspace: { select: { market: true } } },
  });
  if (!rep) return { ok: false as const, error: 'Representative not found', status: 404 };

  const client = await prisma.repClient.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false as const, error: 'Client not found', status: 404 };
  if (client.representativeId !== rep.id) return { ok: false as const, error: 'Forbidden', status: 403 };

  const currency = getMarketConfig((rep.workspace?.market as Market) ?? 'BR').currency;
  return { ok: true as const, client, currency };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await getOwnedClient(id, session.user.id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { client, currency } = ctx;

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const fields = ['name', 'email', 'phone', 'company', 'planId', 'valueCents', 'notes'] as const;
  for (const field of fields) {
    if (parsed.data[field] !== undefined) {
      const value = parsed.data[field];
      data[field] = typeof value === 'string' ? value.trim() || null : value;
    }
  }

  if (parsed.data.status !== undefined && parsed.data.status !== client.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === 'CANCELED' && !client.canceledAt) {
      data.canceledAt = new Date();
    }
    if ((parsed.data.status === 'CONVERTED' || parsed.data.status === 'ACTIVE') && !client.signedAt) {
      data.signedAt = new Date();
    }
  }

  const updated = await prisma.repClient.update({ where: { id }, data });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    company: updated.company,
    planId: updated.planId,
    status: updated.status,
    valueCents: updated.valueCents,
    currency,
    signedAt: updated.signedAt?.toISOString() ?? null,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await getOwnedClient(id, session.user.id);
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  await prisma.repClient.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
