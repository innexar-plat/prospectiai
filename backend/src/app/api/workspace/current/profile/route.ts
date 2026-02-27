import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { workspaceProfileSchema, formatZodError } from '@/lib/validations/schemas';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';

const WORKSPACE_SELECT = {
    companyName: true,
    productService: true,
    targetAudience: true,
    mainBenefit: true,
    address: true,
    linkedInUrl: true,
    instagramUrl: true,
    facebookUrl: true,
    websiteUrl: true,
    logoUrl: true,
} as const;

export async function GET(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            select: { workspaceId: true },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: membership.workspaceId },
            select: WORKSPACE_SELECT,
        });
        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const profile = {
            companyName: workspace.companyName ?? null,
            productService: workspace.productService ?? null,
            targetAudience: workspace.targetAudience ?? null,
            mainBenefit: workspace.mainBenefit ?? null,
            address: workspace.address ?? null,
            linkedInUrl: workspace.linkedInUrl ?? null,
            instagramUrl: workspace.instagramUrl ?? null,
            facebookUrl: workspace.facebookUrl ?? null,
            websiteUrl: workspace.websiteUrl ?? null,
            logoUrl: workspace.logoUrl ?? null,
        };

        return jsonWithRequestId(profile, { requestId });
    } catch (error) {
        logger.error('GET workspace profile error', {
            error: error instanceof Error ? error.message : 'Unknown',
        }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}

export async function PATCH(req: NextRequest) {
    const requestId = getOrCreateRequestId(req);
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { success } = await rateLimit(`workspace-profile:${session.user.id}`, 30, 60);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = workspaceProfileSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }

        const membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            select: { workspaceId: true },
        });
        if (!membership) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        const data = parsed.data;
        const update: Record<string, string | undefined> = {};
        if (data.companyName !== undefined) update.companyName = data.companyName;
        if (data.productService !== undefined) update.productService = data.productService;
        if (data.targetAudience !== undefined) update.targetAudience = data.targetAudience;
        if (data.mainBenefit !== undefined) update.mainBenefit = data.mainBenefit;
        if (data.address !== undefined) update.address = data.address;
        if (data.linkedInUrl !== undefined) update.linkedInUrl = data.linkedInUrl;
        if (data.instagramUrl !== undefined) update.instagramUrl = data.instagramUrl;
        if (data.facebookUrl !== undefined) update.facebookUrl = data.facebookUrl;
        if (data.websiteUrl !== undefined) update.websiteUrl = data.websiteUrl;
        if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl;

        const workspace = await prisma.workspace.update({
            where: { id: membership.workspaceId },
            data: update,
            select: WORKSPACE_SELECT,
        });

        const profile = {
            companyName: workspace.companyName ?? null,
            productService: workspace.productService ?? null,
            targetAudience: workspace.targetAudience ?? null,
            mainBenefit: workspace.mainBenefit ?? null,
            address: workspace.address ?? null,
            linkedInUrl: workspace.linkedInUrl ?? null,
            instagramUrl: workspace.instagramUrl ?? null,
            facebookUrl: workspace.facebookUrl ?? null,
            websiteUrl: workspace.websiteUrl ?? null,
            logoUrl: workspace.logoUrl ?? null,
        };

        return jsonWithRequestId(profile, { requestId });
    } catch (error) {
        logger.error('PATCH workspace profile error', {
            error: error instanceof Error ? error.message : 'Unknown',
        }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
