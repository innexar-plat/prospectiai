import { PrismaAdapter } from '@auth/prisma-adapter';
import type { Adapter, AdapterUser } from '@auth/core/adapters';
import type { PrismaClient } from '@prisma/client';
import { provisionOauthUserWithWorkspace, resolveAdapterMarket } from '@/lib/oauth-registration';

type AdapterUserInput = {
    id?: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | null;
    image?: string | null;
};

function toAdapterUser(user: {
    id: string;
    name?: string | null;
    email?: string | null;
    emailVerified?: Date | null;
    image?: string | null;
}): AdapterUser {
    return {
        id: user.id,
        name: user.name ?? null,
        email: user.email ?? '',
        emailVerified: user.emailVerified ?? null,
        image: user.image ?? null,
    };
}

/**
 * PrismaAdapter with market-aware OAuth signup: user plan data + default workspace on first login.
 */
export function createProspectorAuthAdapter(prisma: PrismaClient): Adapter {
    const base = PrismaAdapter(prisma);
    return {
        ...base,
        async createUser(data: AdapterUserInput) {
            const market = await resolveAdapterMarket();
            const user = await provisionOauthUserWithWorkspace(data, market);
            return toAdapterUser(user);
        },
    };
}
