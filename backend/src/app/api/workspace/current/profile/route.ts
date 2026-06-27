import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { workspaceProfileSchema, formatZodError } from '@/lib/validations/schemas';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';

const WORKSPACE_SELECT = {
    companyName: true,
    legalName: true,
    tradeName: true,
    cnpj: true,
    primaryCnaeCode: true,
    primaryCnaeDescription: true,
    companySize: true,
    foundingDate: true,
    productService: true,
    targetAudience: true,
    mainBenefit: true,
    address: true,
    postalCode: true,
    street: true,
    number: true,
    complement: true,
    neighborhood: true,
    city: true,
    state: true,
    linkedInUrl: true,
    instagramUrl: true,
    facebookUrl: true,
    websiteUrl: true,
    logoUrl: true,
    serviceModel: true,
    averageTicket: true,
    operationRadiusKm: true,
    knownCompetitors: true,
} as const;

type WorkspaceSelected = {
    companyName: string | null;
    legalName: string | null;
    tradeName: string | null;
    cnpj: string | null;
    primaryCnaeCode: string | null;
    primaryCnaeDescription: string | null;
    companySize: string | null;
    foundingDate: string | null;
    productService: string | null;
    targetAudience: string | null;
    mainBenefit: string | null;
    address: string | null;
    postalCode: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    linkedInUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    websiteUrl: string | null;
    logoUrl: string | null;
    serviceModel: string | null;
    averageTicket: number | null;
    operationRadiusKm: number | null;
    knownCompetitors: string | null;
};

function toProfileResponse(workspace: WorkspaceSelected) {
    return {
        companyName: workspace.companyName ?? null,
        legalName: workspace.legalName ?? null,
        tradeName: workspace.tradeName ?? null,
        cnpj: workspace.cnpj ?? null,
        primaryCnaeCode: workspace.primaryCnaeCode ?? null,
        primaryCnaeDescription: workspace.primaryCnaeDescription ?? null,
        companySize: workspace.companySize ?? null,
        foundingDate: workspace.foundingDate ?? null,
        productService: workspace.productService ?? null,
        targetAudience: workspace.targetAudience ?? null,
        mainBenefit: workspace.mainBenefit ?? null,
        address: workspace.address ?? null,
        postalCode: workspace.postalCode ?? null,
        street: workspace.street ?? null,
        number: workspace.number ?? null,
        complement: workspace.complement ?? null,
        neighborhood: workspace.neighborhood ?? null,
        city: workspace.city ?? null,
        state: workspace.state ?? null,
        linkedInUrl: workspace.linkedInUrl ?? null,
        instagramUrl: workspace.instagramUrl ?? null,
        facebookUrl: workspace.facebookUrl ?? null,
        websiteUrl: workspace.websiteUrl ?? null,
        logoUrl: workspace.logoUrl ?? null,
        serviceModel: workspace.serviceModel ?? null,
        averageTicket: workspace.averageTicket ?? null,
        operationRadiusKm: workspace.operationRadiusKm ?? null,
        knownCompetitors: workspace.knownCompetitors ?? null,
    };
}

function buildProfileUpdate(data: Record<string, unknown>): Record<string, unknown> {
    const update: Record<string, unknown> = {};
    if (data.companyName !== undefined) update.companyName = data.companyName;
    if (data.legalName !== undefined) update.legalName = data.legalName;
    if (data.tradeName !== undefined) update.tradeName = data.tradeName;
    if (data.cnpj !== undefined) update.cnpj = data.cnpj;
    if (data.primaryCnaeCode !== undefined) update.primaryCnaeCode = data.primaryCnaeCode;
    if (data.primaryCnaeDescription !== undefined) update.primaryCnaeDescription = data.primaryCnaeDescription;
    if (data.companySize !== undefined) update.companySize = data.companySize;
    if (data.foundingDate !== undefined) update.foundingDate = data.foundingDate;
    if (data.productService !== undefined) update.productService = data.productService;
    if (data.targetAudience !== undefined) update.targetAudience = data.targetAudience;
    if (data.mainBenefit !== undefined) update.mainBenefit = data.mainBenefit;
    if (data.address !== undefined) update.address = data.address;
    if (data.postalCode !== undefined) update.postalCode = data.postalCode;
    if (data.street !== undefined) update.street = data.street;
    if (data.number !== undefined) update.number = data.number;
    if (data.complement !== undefined) update.complement = data.complement;
    if (data.neighborhood !== undefined) update.neighborhood = data.neighborhood;
    if (data.city !== undefined) update.city = data.city;
    if (data.state !== undefined) update.state = data.state;
    if (data.linkedInUrl !== undefined) update.linkedInUrl = data.linkedInUrl;
    if (data.instagramUrl !== undefined) update.instagramUrl = data.instagramUrl;
    if (data.facebookUrl !== undefined) update.facebookUrl = data.facebookUrl;
    if (data.websiteUrl !== undefined) update.websiteUrl = data.websiteUrl;
    if (data.logoUrl !== undefined) update.logoUrl = data.logoUrl;
    if (data.serviceModel !== undefined) update.serviceModel = data.serviceModel;
    if (data.averageTicket !== undefined) update.averageTicket = data.averageTicket;
    if (data.operationRadiusKm !== undefined) update.operationRadiusKm = data.operationRadiusKm;
    if (data.knownCompetitors !== undefined) update.knownCompetitors = data.knownCompetitors;
    return update;
}

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

        return jsonWithRequestId(toProfileResponse(workspace), { requestId });
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

        const update = buildProfileUpdate(parsed.data);
        const workspace = await prisma.workspace.update({
            where: { id: membership.workspaceId },
            data: update,
            select: WORKSPACE_SELECT,
        });

        return jsonWithRequestId(toProfileResponse(workspace), { requestId });
    } catch (error) {
        logger.error('PATCH workspace profile error', {
            error: error instanceof Error ? error.message : 'Unknown',
        }, requestId);
        return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
    }
}
