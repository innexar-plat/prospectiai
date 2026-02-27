import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            plan: true,
            disabledAt: true,
            leadsUsed: true,
            leadsLimit: true,
            onboardingCompletedAt: true,
            companyName: true,
            productService: true,
            targetAudience: true,
            mainBenefit: true,
            createdAt: true,
            updatedAt: true,
            workspaces: { include: { workspace: true } },
        },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    logAdminAction(session, 'admin.users.get', { resource: 'users', resourceId: id }).catch(() => {});
    return NextResponse.json(user);
}
