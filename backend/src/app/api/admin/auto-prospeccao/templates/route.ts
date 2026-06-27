import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import type { AutoProspTemplateType } from '@prisma/client';

const VALID_TYPES: AutoProspTemplateType[] = [
  'HOT_COLD_INTRO',
  'HOT_FOLLOW_NO_OPEN',
  'HOT_FOLLOW_OPENED',
  'HOT_LAST_ATTEMPT',
  'WARM_WEEK1_EDUCATION',
  'WARM_WEEK2_VALUE',
  'WARM_WEEK3_SOCIAL',
  'WARM_WEEK4_OFFER',
  'CUSTOM',
];

/** GET /api/admin/auto-prospeccao/templates */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const isSystem = searchParams.get('isSystem');
  const type = searchParams.get('type') as AutoProspTemplateType | null;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

  const where = {
    ...(isSystem === 'true' ? { isSystem: true } : isSystem === 'false' ? { isSystem: false } : {}),
    ...(type && VALID_TYPES.includes(type) ? { type } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.autoProspeccaoTemplate.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isSystem: 'desc' }, { type: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        type: true,
        subject: true,
        preheader: true,
        targetCnae: true,
        targetSegment: true,
        isSystem: true,
        workspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.autoProspeccaoTemplate.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/admin/auto-prospeccao/templates */
export async function POST(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;
  const { session } = authResult;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { name, type, subject, preheader, bodyHtml, bodyText, targetCnae, targetSegment, isSystem, workspaceId } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim() === '')
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!type || !VALID_TYPES.includes(type as AutoProspTemplateType))
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  if (!subject || typeof subject !== 'string' || subject.trim() === '')
    return NextResponse.json({ error: 'subject is required' }, { status: 400 });
  if (!bodyHtml || typeof bodyHtml !== 'string' || bodyHtml.trim() === '')
    return NextResponse.json({ error: 'bodyHtml is required' }, { status: 400 });

  const template = await prisma.autoProspeccaoTemplate.create({
    data: {
      name: (name as string).trim(),
      type: type as AutoProspTemplateType,
      subject: (subject as string).trim(),
      preheader: typeof preheader === 'string' ? preheader.trim() || null : null,
      bodyHtml: bodyHtml as string,
      bodyText: typeof bodyText === 'string' ? bodyText.trim() || null : null,
      targetCnae: typeof targetCnae === 'string' ? targetCnae.trim() || null : null,
      targetSegment: typeof targetSegment === 'string' ? targetSegment.trim() || null : null,
      isSystem: isSystem === true,
      workspaceId: typeof workspaceId === 'string' ? workspaceId || null : null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ data: template }, { status: 201 });
}
