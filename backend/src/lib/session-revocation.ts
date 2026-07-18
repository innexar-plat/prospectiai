import { prisma } from "@/lib/prisma";

export type TokenRevocationResult =
    | { revoked: true }
    | { revoked: false; email: string | null; tokenVersion: number };

/**
 * Checks whether a JWT session should be killed: the account was deleted/deactivated,
 * or its `tokenVersion` was bumped server-side (password change, admin force-logout)
 * since this JWT was last refreshed. `incomingTokenVersion` is the version already baked
 * into the JWT from the previous request — comparing it against a fresh DB read is what
 * detects a revoked session; skip the comparison on a fresh login (no prior version yet).
 */
export async function checkTokenRevocation(
    userId: string,
    incomingTokenVersion: number | undefined,
    isFreshLogin: boolean,
): Promise<TokenRevocationResult> {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, tokenVersion: true, disabledAt: true },
    });

    if (!dbUser || dbUser.disabledAt) {
        return { revoked: true };
    }
    if (!isFreshLogin && incomingTokenVersion !== undefined && dbUser.tokenVersion !== incomingTokenVersion) {
        return { revoked: true };
    }
    return { revoked: false, email: dbUser.email, tokenVersion: dbUser.tokenVersion };
}
