import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await prisma.user.update({
        where: { id },
        data: { tokenVersion: { increment: 1 } },
    });

    logAdminAction(session, 'admin.users.force-logout', {
        resource: 'users',
        resourceId: id,
        details: { targetEmail: user.email },
    }).catch(() => {});

    return NextResponse.json({ message: 'User force logged out successfully' });
}
