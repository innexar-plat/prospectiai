import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import type { AutoProspTemplateType } from '@prisma/client';

const VALID_TYPES: AutoProspTemplateType[] = [
  'HOT_COLD_INTRO', 'HOT_FOLLOW_NO_OPEN', 'HOT_FOLLOW_OPENED', 'HOT_LAST_ATTEMPT',
  'WARM_WEEK1_EDUCATION', 'WARM_WEEK2_VALUE', 'WARM_WEEK3_SOCIAL', 'WARM_WEEK4_OFFER', 'CUSTOM',
];

/** GET /api/admin/auto-prospeccao/templates/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const template = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: template });
}

/** PATCH /api/admin/auto-prospeccao/templates/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { name, type, subject, preheader, bodyHtml, bodyText, targetCnae, targetSegment, isSystem } = body as Record<string, unknown>;

  if (type !== undefined && !VALID_TYPES.includes(type as AutoProspTemplateType))
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });

  const updated = await prisma.autoProspeccaoTemplate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(type !== undefined && { type: type as AutoProspTemplateType }),
      ...(subject !== undefined && { subject: (subject as string).trim() }),
      ...(preheader !== undefined && { preheader: typeof preheader === 'string' ? preheader.trim() || null : null }),
      ...(bodyHtml !== undefined && { bodyHtml: bodyHtml as string }),
      ...(bodyText !== undefined && { bodyText: typeof bodyText === 'string' ? bodyText.trim() || null : null }),
      ...(targetCnae !== undefined && { targetCnae: typeof targetCnae === 'string' ? targetCnae.trim() || null : null }),
      ...(targetSegment !== undefined && { targetSegment: typeof targetSegment === 'string' ? targetSegment.trim() || null : null }),
      ...(isSystem !== undefined && { isSystem: isSystem === true }),
    },
  });

  return NextResponse.json({ data: updated });
}

/** DELETE /api/admin/auto-prospeccao/templates/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await prisma.autoProspeccaoTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.autoProspeccaoTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
