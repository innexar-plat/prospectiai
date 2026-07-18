import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { verifyTotpToken } from "@/lib/twofa";

/** Distinguishes "needs a 2FA code" from "wrong credentials" in the signin redirect's `code` param. */
export class TwoFactorRequiredError extends CredentialsSignin {
    code = "two_factor_required";
}

export class TwoFactorInvalidError extends CredentialsSignin {
    code = "two_factor_invalid";
}

/**
 * Core credentials-login logic, extracted from the NextAuth Credentials provider's
 * `authorize()` so it can be unit tested without booting the full NextAuth config.
 */
export async function authorizeCredentials(
    email: unknown,
    plainPassword: unknown,
    rawCode: unknown,
    ip: string,
) {
    if (typeof email !== "string" || typeof plainPassword !== "string") {
        return null;
    }
    const code = typeof rawCode === "string" ? rawCode.trim() : "";

    const { success } = await rateLimit(`login:${ip}:${email.toLowerCase()}`, 10, 300);
    if (!success) {
        throw new CredentialsSignin("Muitas tentativas de login. Tente novamente em alguns minutos.");
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(plainPassword, user.password || "");
    if (!isValid) return null;

    if (user.disabledAt) {
        throw new CredentialsSignin("Conta desativada. Entre em contato com o suporte.");
    }

    if (user.twoFactorEnabled) {
        if (!code) {
            throw new TwoFactorRequiredError();
        }
        if (!user.twoFactorSecret || !verifyTotpToken(user.twoFactorSecret, code)) {
            throw new TwoFactorInvalidError();
        }
    }

    return user;
}
