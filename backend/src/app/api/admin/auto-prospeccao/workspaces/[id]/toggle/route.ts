import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';

/** POST /api/admin/auto-prospeccao/workspaces/[id]/toggle — enable/disable module for a workspace */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true, autoProspeccaoEnabled: true },
  });

  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const updated = await prisma.workspace.update({
    where: { id },
    data: { autoProspeccaoEnabled: !workspace.autoProspeccaoEnabled },
    select: { id: true, autoProspeccaoEnabled: true, name: true },
  });

  return NextResponse.json({ data: updated });
}
