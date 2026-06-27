import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireModuleEnabled } from '../../../_helpers';

/** POST /api/auto-prospeccao/team/[memberId]/toggle — toggle auto-prospecção for a team member */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only OWNER/ADMIN can manage team access
  const callerMember = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } },
    select: { workspaceId: true },
  });
  if (!callerMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const err = await requireModuleEnabled(callerMember.workspaceId);
  if (err) return err;

  const { memberId } = await params;

  const targetMember = await prisma.workspaceMember.findFirst({
    where: { id: memberId, workspaceId: callerMember.workspaceId },
    select: { id: true, autoProspeccaoEnabled: true },
  });

  if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { autoProspeccaoEnabled: !targetMember.autoProspeccaoEnabled },
    select: { id: true, autoProspeccaoEnabled: true },
  });

  return NextResponse.json({ data: updated });
}
