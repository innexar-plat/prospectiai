import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { invalidateRfCrossConfigCache } from '@/modules/search/application/search-rf-integration';
import { z } from 'zod';

const RF_CONFIG_ID = 'rf-search-config-default';

const patchSchema = z.object({
  enabled: z.boolean(),
});

export type RfConfigPublic = {
  id: string;
  enabled: boolean;
  updatedAt: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let row = await prisma.rfSearchConfig.findUnique({ where: { id: RF_CONFIG_ID } });
  if (!row) {
    row = await prisma.rfSearchConfig.create({
      data: { id: RF_CONFIG_ID, enabled: true },
    });
  }
  return NextResponse.json(serialize(row));
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }
  const row = await prisma.rfSearchConfig.upsert({
    where: { id: RF_CONFIG_ID },
    create: { id: RF_CONFIG_ID, enabled: parsed.data.enabled },
    update: { enabled: parsed.data.enabled },
  });
  invalidateRfCrossConfigCache();
  return NextResponse.json(serialize(row));
}

function serialize(row: { id: string; enabled: boolean; updatedAt: Date }): RfConfigPublic {
  return {
    id: row.id,
    enabled: row.enabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}
