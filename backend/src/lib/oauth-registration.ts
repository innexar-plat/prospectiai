import { headers } from 'next/headers';
import { getRequestMarket, MARKET, type Market } from '@/lib/market';
import { buildRegistrationUserData, buildRegistrationWorkspaceData, defaultWorkspaceName } from '@/lib/registration';
import { attachReferralOnSignup, parseAffiliateRefFromCookie } from '@/lib/affiliate';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

/** Market for OAuth adapter callbacks (cookie / host on the auth callback request). */
export async function resolveAdapterMarket(): Promise<Market> {
    try {
        const h = await headers();
        const req = new Request('http://internal', {
            headers: {
                cookie: h.get('cookie') ?? '',
                host: h.get('x-forwarded-host') ?? h.get('host') ?? '',
                'x-prospector-market': h.get('x-prospector-market') ?? '',
            },
        });
        return getRequestMarket(req);
    } catch {
        return MARKET;
    }
}

export async function resolveAdapterAffiliateCode(): Promise<string | null> {
    try {
        const h = await headers();
        return parseAffiliateRefFromCookie(h.get('cookie'));
    } catch {
        return null;
    }
}

type OAuthUserInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | null;
    image?: string | null;
};

/**
 * Creates OAuth user with market-specific plan data and default workspace (first login).
 */
export async function provisionOauthUserWithWorkspace(
    data: OAuthUserInput,
    market: Market = MARKET,
): Promise<Prisma.UserGetPayload<object>> {
    const { id: _id, ...rest } = data;
    const regUser = buildRegistrationUserData(market);
    const workspaceName = defaultWorkspaceName(market, rest.name);

    const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                ...rest,
                ...regUser,
            },
        });
        const workspace = await tx.workspace.create({
            data: buildRegistrationWorkspaceData(workspaceName, market),
        });
        await tx.workspaceMember.create({
            data: { userId: created.id, workspaceId: workspace.id, role: 'OWNER' },
        });
        logger.info('OAuth user provisioned with workspace', {
            userId: created.id,
            workspaceId: workspace.id,
            market,
            plan: workspace.plan,
        });
        return { user: created, workspaceId: workspace.id };
    });

    const affiliateCode = await resolveAdapterAffiliateCode();
    if (affiliateCode && user.user.email) {
        await attachReferralOnSignup({
            affiliateCode,
            userId: user.user.id,
            workspaceId: user.workspaceId,
            email: user.user.email,
        });
    }

    return user.user;
}
