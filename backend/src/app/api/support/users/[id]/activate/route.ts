import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSupport } from '@/lib/admin';
import { logSupportAction } from '@/lib/audit';

export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSupport(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, disabledAt: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.disabledAt) {
        return NextResponse.json({ error: 'User account is already active' }, { status: 400 });
    }
    await prisma.user.update({
        where: { id },
        data: { disabledAt: null },
    });
    void logSupportAction(session, 'support.users.activate', { resource: 'users', resourceId: id });
    return NextResponse.json({ success: true });
}
