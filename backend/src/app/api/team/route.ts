import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import type { ProductPlan } from '@/lib/product-modules';
import { sendTeamInviteEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const SITE_URL = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

const inviteBodySchema = z.object({
    email: z.email().transform((s) => s.trim().toLowerCase()),
    role: z.enum(['MEMBER', 'ADMIN']).optional().default('MEMBER'),
});

type CreateInvitationResult =
    | { ok: true; invitation: { id: string; email: string; createdAt: Date; lastSentAt: Date }; inviterName: string; workspaceName: string; email: string; acceptInviteUrl: string }
    | { ok: false; error: NextResponse };

async function createInvitationOrError(
    session: { user: { id: string; name?: string | null; email?: string | null } },
    body: unknown,
    requestId: string,
): Promise<CreateInvitationResult> {
    const parsed = inviteBodySchema.safeParse(body);
    if (!parsed.success) {
        return { ok: false, error: jsonWithRequestId({ error: 'Email inválido' }, { status: 400, requestId }) };
    }
    const callerMembership = await prisma.workspaceMember.findFirst({
        where: { userId: session.user.id },
        include: { workspace: true },
    });
    if (!callerMembership || !['OWNER', 'ADMIN'].includes(callerMembership.role)) {
        return { ok: false, error: jsonWithRequestId({ error: 'Only admins can invite members' }, { status: 403, requestId }) };
    }
    const plan: ProductPlan = (callerMembership.workspace.plan as ProductPlan) ?? 'FREE';
    if (plan !== 'SCALE') {
        return { ok: false, error: jsonWithRequestId({ error: 'Team management requires Scale plan' }, { status: 403, requestId }) };
    }
    const email = parsed.data.email;
    const workspaceId = callerMembership.workspaceId;
    const existingMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId, user: { email } },
    });
    if (existingMember) {
        return { ok: false, error: jsonWithRequestId({ error: 'Usuário já é membro do workspace' }, { status: 409, requestId }) };
    }
    const token = crypto.randomBytes(32).toString('hex');
    const invitation = await prisma.workspaceInvitation.upsert({
        where: { email_workspaceId: { email, workspaceId } },
        create: {
            email,
            workspaceId,
            invitedById: session.user.id,
            token,
            status: 'PENDING',
        },
        update: { token, lastSentAt: new Date(), status: 'PENDING' },
    });
    const inviterName = session.user.name ?? session.user.email ?? 'A team member';
    const workspaceName = callerMembership.workspace.name ?? 'Workspace';
    const baseUrl = SITE_URL.replace(/\/$/, '');
    const acceptInviteUrl = `${baseUrl}/accept-invite?token=${encodeURIComponent(token)}`;
    return {
        ok: true,
        invitation: {
            id: invitation.id,
            email: invitation.email,
            createdAt: invitation.createdAt,
            lastSentAt: invitation.lastSentAt,
        },
        inviterName,
        workspaceName,
        email,
        acceptInviteUrl,
    };
}

type MemberWithUser = Awaited<ReturnType<typeof prisma.workspaceMember.findMany>>[number] & {
    user: { id: string; name: string | null; email: string | null; image: string | null; leadsUsed: number };
};

function buildMembersResult(
    members: MemberWithUser[],
    activityMap: Map<string, number>,
    leadMap: Map<string, number>,
) {
    return members.map((m) => ({
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
}

type MembershipWithWorkspace = NonNullable<Awaited<ReturnType<typeof prisma.workspaceMember.findFirst>>> & { workspace: { id: string; name: string | null; plan: string; leadsUsed: number; leadsLimit: number } };

async function fetchTeamData(membership: MembershipWithWorkspace) {
    const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: membership.workspaceId },
        include: {
            user: {
                select: { id: true, name: true, email: true, image: true, leadsUsed: true },
            },
        },
        orderBy: { createdAt: 'asc' },
    });
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
    const leadCounts = await prisma.leadAnalysis.groupBy({
        by: ['userId'],
        where: {
            workspaceId: membership.workspaceId,
            userId: { in: members.map((m) => m.user.id) },
        },
        _count: { id: true },
    });
    const leadMap = new Map(leadCounts.map((l) => [l.userId, l._count.id]));
    const pendingInvitations = await prisma.workspaceInvitation.findMany({
        where: { workspaceId: membership.workspaceId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, createdAt: true, lastSentAt: true },
    });
    return {
        members: buildMembersResult(members, activityMap, leadMap),
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
            lastSentAt: (p.lastSentAt ?? p.createdAt).toISOString(),
        })),
    };
}

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
        const data = await fetchTeamData(membership);
        return jsonWithRequestId(data, { requestId });
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
        const result = await createInvitationOrError(session, body, requestId);
        if (!result.ok) return result.error;

        const { invitation, inviterName, workspaceName, email, acceptInviteUrl } = result;
        sendTeamInviteEmail(email, inviterName, workspaceName, acceptInviteUrl)
                .then((res) => {
                    if (!res.sent) logger.warn('Team invite email not sent', { email, reason: res.error ?? 'no config' }, requestId);
                    else logger.info('Team invite email sent', { email }, requestId);
                })
                .catch((err) => logger.error('Team invite email failed', { email, error: err instanceof Error ? err.message : 'Unknown' }, requestId));

        return jsonWithRequestId({
            ok: true,
            pendingInvite: {
                id: invitation.id,
                email: invitation.email,
                createdAt: invitation.createdAt.toISOString(),
                lastSentAt: (invitation.lastSentAt ?? invitation.createdAt).toISOString(),
            },
        }, { requestId });
    } catch (err) {
        const { logger } = await import('@/lib/logger');
        logger.error('Team invite error', { error: err instanceof Error ? err.message : 'Unknown' }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
