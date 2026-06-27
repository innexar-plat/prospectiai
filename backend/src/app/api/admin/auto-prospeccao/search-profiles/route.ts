import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/** GET /api/admin/auto-prospeccao/search-profiles */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const isSystem = searchParams.get('isSystem');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));

  const where = {
    ...(isSystem === 'true' ? { isSystem: true } : isSystem === 'false' ? { isSystem: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.searchProfile.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ isSystem: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        priority: true,
        cnae: true,
        cnaeList: true,
        uf: true,
        porte: true,
        hasEmail: true,
        hasPhone: true,
        minCapital: true,
        workspaceId: true,
        lastRunAt: true,
        totalFound: true,
        totalHot: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.searchProfile.count({ where }),
  ]);

  return NextResponse.json({
    data: items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/admin/auto-prospeccao/search-profiles */
export async function POST(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { name, description, isSystem, isActive, priority, cnae, cnaeList, uf, porte, hasEmail, hasPhone, minCapital, openedAfter, workspaceId } = body as Record<string, unknown>;

  if (!name || typeof name !== 'string' || name.trim() === '')
    return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const profile = await prisma.searchProfile.create({
    data: {
      name: (name as string).trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      isSystem: isSystem === true,
      isActive: isActive !== false,
      priority: typeof priority === 'number' ? priority : 0,
      cnae: typeof cnae === 'string' ? cnae.trim() || null : null,
      cnaeList: Array.isArray(cnaeList) ? cnaeList : Prisma.JsonNull,
      uf: Array.isArray(uf) ? uf : Prisma.JsonNull,
      porte: Array.isArray(porte) ? porte : Prisma.JsonNull,
      hasEmail: typeof hasEmail === 'boolean' ? hasEmail : null,
      hasPhone: typeof hasPhone === 'boolean' ? hasPhone : null,
      minCapital: typeof minCapital === 'number' ? minCapital : null,
      openedAfter: typeof openedAfter === 'string' ? openedAfter.trim() || null : null,
      workspaceId: typeof workspaceId === 'string' ? workspaceId || null : null,
    },
  });

  return NextResponse.json({ data: profile }, { status: 201 });
}
