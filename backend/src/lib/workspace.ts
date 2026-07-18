import { prisma } from '@/lib/prisma';

/** Returns the first workspace id for a user, if any. */
export async function getWorkspaceIdForUser(userId: string): Promise<string | undefined> {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { workspaces: { include: { workspace: true }, orderBy: { workspace: { createdAt: 'asc' } }, take: 1 } },
    });
    return user?.workspaces?.length ? user.workspaces[0]!.workspace.id : undefined;
}
