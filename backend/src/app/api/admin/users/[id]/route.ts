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
            market: true,
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

import { adminUserUpdateSchema, formatZodError } from '@/lib/validations/schemas';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const updated = await prisma.user.update({
        where: { id },
        data: parsed.data,
    });
    
    logAdminAction(session, 'admin.users.update', {
        resource: 'users',
        resourceId: id,
        details: parsed.data,
    }).catch(() => {});
    
    return NextResponse.json(updated);
}
