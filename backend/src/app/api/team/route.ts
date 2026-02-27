import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { planHasModule, type ProductPlan } from '@/lib/product-modules';
import { z } from 'zod';

// GET /api/team/members — list workspace members + stats
export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!membership) {
            return jsonWithRequestId({ error: 'No workspace found' }, { status: 404, requestId });
        }

        const plan: ProductPlan = (membership.workspace.plan as ProductPlan) ?? 'FREE';
        if (plan !== 'SCALE') {
            return jsonWithRequestId({ error: 'Team management is only available on Scale plan.' }, { status: 403, requestId });
        }

        // Get all members
        const members = await prisma.workspaceMember.findMany({
            where: { workspaceId: membership.workspaceId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, image: true, leadsUsed: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Get activity counts per user (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const activityCounts = await prisma.auditLog.groupBy({
            by: ['userId'],
            where: {
                userId: { in: members.map((m) => m.user.id) },
                createdAt: { gte: thirtyDaysAgo },
            },
            _count: { id: true },
        });

        const activityMap = new Map(activityCounts.map((a) => [a.userId, a._count.id]));

        // Get leads analyzed per user
        const leadCounts = await prisma.leadAnalysis.groupBy({
            by: ['userId'],
            where: {
                workspaceId: membership.workspaceId,
                userId: { in: members.map((m) => m.user.id) },
            },
            _count: { id: true },
        });

        const leadMap = new Map(leadCounts.map((l) => [l.userId, l._count.id]));

        const result = members.map((m) => ({
            id: m.id,
            userId: m.user.id,
            name: m.user.name,
            email: m.user.email,
            image: m.user.image,
            role: m.role,
            leadsUsed: m.user.leadsUsed,
            leadsAnalyzed: leadMap.get(m.user.id) ?? 0,
            actionsLast30d: activityMap.get(m.user.id) ?? 0,
            joinedAt: m.createdAt,
            dailyLeadsGoal: m.dailyLeadsGoal ?? null,
            dailyAnalysesGoal: m.dailyAnalysesGoal ?? null,
            monthlyConversionsGoal: m.monthlyConversionsGoal ?? null,
        }));

        return jsonWithRequestId({
            members: result,
            workspace: {
                id: membership.workspaceId,
                name: membership.workspace.name,
                plan: membership.workspace.plan,
                leadsUsed: membership.workspace.leadsUsed,
                leadsLimit: membership.workspace.leadsLimit,
            },
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team members error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

// POST /api/team — invite a new member
export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const schema = z.object({
            email: z.string().email(),
            role: z.enum(['MEMBER', 'ADMIN']).optional().default('MEMBER'),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Email inválido' }, { status: 400, requestId });
        }

        // Verify caller is OWNER or ADMIN
        const callerMembership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            include: { workspace: true },
        });

        if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
            return jsonWithRequestId({ error: 'Only admins can invite members' }, { status: 403, requestId });
        }

        const plan: ProductPlan = (callerMembership.workspace.plan as ProductPlan) ?? 'FREE';
        if (plan !== 'SCALE') {
            return jsonWithRequestId({ error: 'Team management requires Scale plan' }, { status: 403, requestId });
        }

        // Find or create user
        let invitedUser = await prisma.user.findUnique({
            where: { email: parsed.data.email },
        });

        if (!invitedUser) {
            // Auto-create user as part of the workspace
            invitedUser = await prisma.user.create({
                data: {
                    email: parsed.data.email,
                    name: parsed.data.email.split('@')[0],
                    plan: callerMembership.workspace.plan,
                },
            });
        }

        // Check if already a member
        const existing = await prisma.workspaceMember.findUnique({
            where: {
                userId_workspaceId: {
                    userId: invitedUser.id,
                    workspaceId: callerMembership.workspaceId,
                },
            },
        });

        if (existing) {
            return jsonWithRequestId({ error: 'Usuário já é membro do workspace' }, { status: 409, requestId });
        }

        // Add member
        const newMember = await prisma.workspaceMember.create({
            data: {
                userId: invitedUser.id,
                workspaceId: callerMembership.workspaceId,
                role: parsed.data.role,
            },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } },
            },
        });

        return jsonWithRequestId({
            ok: true,
            member: {
                id: newMember.id,
                userId: newMember.user.id,
                name: newMember.user.name,
                email: newMember.user.email,
                role: newMember.role,
            },
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team invite error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
