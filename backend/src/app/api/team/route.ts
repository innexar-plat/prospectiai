import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import type { ProductPlan } from '@/lib/product-modules';
import { sendTeamInviteEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

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

        const pendingInvitations = await prisma.workspaceInvitation.findMany({
            where: { workspaceId: membership.workspaceId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, createdAt: true, lastSentAt: true },
        });

        return jsonWithRequestId({
            members: result,
            workspace: {
                id: membership.workspaceId,
                name: membership.workspace.name,
                plan: membership.workspace.plan,
                leadsUsed: membership.workspace.leadsUsed,
                leadsLimit: membership.workspace.leadsLimit,
            },
            pendingInvitations: pendingInvitations.map((p) => ({
                id: p.id,
                email: p.email,
                createdAt: p.createdAt.toISOString(),
                lastSentAt: p.lastSentAt.toISOString(),
            })),
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team members error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

// POST /api/team — create pending invitation and send email; user joins only after accepting
export async function POST(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
        }

        const body = await req.json();
        const schema = z.object({
            email: z.email().transform((s) => s.trim().toLowerCase()),
            role: z.enum(['MEMBER', 'ADMIN']).optional().default('MEMBER'),
        });

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return jsonWithRequestId({ error: 'Email inválido' }, { status: 400, requestId });
        }

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

        const email = parsed.data.email;
        const workspaceId = callerMembership.workspaceId;
        const inviterName = session.user.name ?? session.user.email ?? 'A team member';
        const workspaceName = callerMembership.workspace.name ?? 'Workspace';

        const existingMember = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId,
                user: { email },
            },
        });
        if (existingMember) {
            return jsonWithRequestId({ error: 'Usuário já é membro do workspace' }, { status: 409, requestId });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const baseUrl = SITE_URL.replace(/\/$/, '');
        const acceptInviteUrl = `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;

        const invitation = await prisma.workspaceInvitation.upsert({
            where: {
                email_workspaceId: { email, workspaceId },
            },
            create: {
                email,
                workspaceId,
                invitedById: session.user.id,
                token,
                status: 'PENDING',
            },
            update: {
                token,
                lastSentAt: new Date(),
                status: 'PENDING',
            },
        });

        sendTeamInviteEmail(email, inviterName, workspaceName, acceptInviteUrl)
            .then((result) => {
                if (!result.sent) {
                    logger.warn('Team invite email not sent', { email, reason: result.error ?? 'no config' }, requestId);
                } else {
                    logger.info('Team invite email sent', { email }, requestId);
                }
            })
            .catch((err) => {
                logger.error('Team invite email failed', { email, error: err instanceof Error ? err.message : 'Unknown' }, requestId);
            });

        return jsonWithRequestId({
            ok: true,
            pendingInvite: {
                id: invitation.id,
                email: invitation.email,
                createdAt: invitation.createdAt.toISOString(),
                lastSentAt: invitation.lastSentAt.toISOString(),
            },
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team invite error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
