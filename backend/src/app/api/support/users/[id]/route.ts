import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSupport } from '@/lib/admin';
import { logSupportAction } from '@/lib/audit';

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSupport(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            plan: true,
            disabledAt: true,
            createdAt: true,
            companyName: true,
            productService: true,
            targetAudience: true,
            mainBenefit: true,
            onboardingCompletedAt: true,
            workspaces: {
                select: { workspace: { select: { id: true, name: true } } },
            },
        },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    logSupportAction(session, 'support.users.get', { resource: 'users', resourceId: id }).catch(() => {});
    return NextResponse.json({
        ...user,
        workspaces: user.workspaces.map((w) => w.workspace),
    });
}
