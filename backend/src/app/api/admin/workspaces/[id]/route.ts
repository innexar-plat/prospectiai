import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { PLANS } from '@/lib/billing-config';
import { getWorkspaceUsage } from '@/lib/usage';
import { adminWorkspaceUpdateSchema, formatZodError } from '@/lib/validations/schemas';

const workspaceCountSelect = {
    analyses: true,
    searchHistory: true,
} as Prisma.WorkspaceCountOutputTypeSelect;

function getDefaultLeadsLimitForPlan(plan: string): number {
    if (plan in PLANS) return PLANS[plan as keyof typeof PLANS].leadsLimit;
    return 0;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            _count: { select: workspaceCountSelect },
        },
    });
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const usageMap = await getWorkspaceUsage([id]);
    const usage = usageMap.get(id) ?? null;
    void logAdminAction(session, 'admin.workspaces.get', { resource: 'workspaces', resourceId: id });
    return NextResponse.json({ ...workspace, usage });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = adminWorkspaceUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    const { plan, leadsLimit } = parsed.data;
    const data: { plan?: (typeof parsed.data)['plan']; leadsLimit?: number } = {};
    if (plan != null) data.plan = plan;
    if (leadsLimit !== undefined) {
        data.leadsLimit = leadsLimit;
    } else if (plan != null) {
        data.leadsLimit = getDefaultLeadsLimitForPlan(plan);
    }
    const updated = await prisma.workspace.update({
        where: { id },
        data,
        include: {
            members: { include: { user: { select: { id: true, name: true, email: true } } } },
            _count: { select: { members: true, ...workspaceCountSelect } },
        },
    });
    const usageMap = await getWorkspaceUsage([id]);
    const usage = usageMap.get(id) ?? null;
    void logAdminAction(session, 'admin.workspaces.update', {
        resource: 'workspaces',
        resourceId: id,
        details: { plan: data.plan, leadsLimit: data.leadsLimit },
    });
    return NextResponse.json({ ...updated, usage });
}
