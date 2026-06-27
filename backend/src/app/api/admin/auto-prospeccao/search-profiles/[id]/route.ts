import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/** GET /api/admin/auto-prospeccao/search-profiles/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const profile = await prisma.searchProfile.findUnique({ where: { id } });
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: profile });
}

/** PATCH /api/admin/auto-prospeccao/search-profiles/[id] */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await prisma.searchProfile.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { name, description, isSystem, isActive, priority, cnae, cnaeList, uf, porte, hasEmail, hasPhone, minCapital, openedAfter } = body as Record<string, unknown>;

  const updated = await prisma.searchProfile.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: (name as string).trim() }),
      ...(description !== undefined && { description: typeof description === 'string' ? description.trim() || null : null }),
      ...(isSystem !== undefined && { isSystem: isSystem === true }),
      ...(isActive !== undefined && { isActive: isActive === true }),
      ...(priority !== undefined && { priority: typeof priority === 'number' ? priority : 0 }),
      ...(cnae !== undefined && { cnae: typeof cnae === 'string' ? cnae.trim() || null : null }),
      ...(cnaeList !== undefined && { cnaeList: Array.isArray(cnaeList) ? cnaeList : Prisma.JsonNull }),
      ...(uf !== undefined && { uf: Array.isArray(uf) ? uf : Prisma.JsonNull }),
      ...(porte !== undefined && { porte: Array.isArray(porte) ? porte : Prisma.JsonNull }),
      ...(hasEmail !== undefined && { hasEmail: typeof hasEmail === 'boolean' ? hasEmail : null }),
      ...(hasPhone !== undefined && { hasPhone: typeof hasPhone === 'boolean' ? hasPhone : null }),
      ...(minCapital !== undefined && { minCapital: typeof minCapital === 'number' ? minCapital : null }),
      ...(openedAfter !== undefined && { openedAfter: typeof openedAfter === 'string' ? openedAfter.trim() || null : null }),
    },
  });

  return NextResponse.json({ data: updated });
}

/** DELETE /api/admin/auto-prospeccao/search-profiles/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const existing = await prisma.searchProfile.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Prevent deletion if it has related runs (data integrity)
  const runsCount = await prisma.autoProspeccaoRun.count({ where: { searchProfileId: id } });
  if (runsCount > 0)
    return NextResponse.json({ error: 'Cannot delete a profile that has associated runs. Deactivate it instead.' }, { status: 409 });

  await prisma.searchProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
