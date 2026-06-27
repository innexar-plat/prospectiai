import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: string;
};

type AuthResult =
  | { ok: true; ctx: WorkspaceContext }
  | { ok: false; error: NextResponse };

/** Authenticate request and return workspace context */
export async function requireWorkspace(requireOwner = false): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const member = await prisma.workspaceMember.findFirst({
    where: requireOwner
      ? { userId: session.user.id, role: { in: ['OWNER', 'ADMIN'] } }
      : { userId: session.user.id },
    select: { workspaceId: true, role: true },
  });

  if (!member) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: requireOwner ? 'Forbidden' : 'Workspace not found' },
        { status: requireOwner ? 403 : 404 },
      ),
    };
  }

  return { ok: true, ctx: { userId: session.user.id, workspaceId: member.workspaceId, role: member.role } };
}

/** Check if auto-prospecção module is enabled for a workspace */
export async function requireModuleEnabled(workspaceId: string): Promise<NextResponse | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { autoProspeccaoEnabled: true },
  });
  if (!ws?.autoProspeccaoEnabled) {
    return NextResponse.json({ error: 'Módulo não habilitado para este workspace' }, { status: 403 });
  }
  return null;
}
