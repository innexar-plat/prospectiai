import NextAuth, { CredentialsSignin } from "next-auth"
import { createProspectorAuthAdapter } from "@/lib/auth-adapter"
import { prisma } from "@/lib/prisma"
import { getPanelRole } from "@/lib/admin"
import { logger } from "@/lib/logger"
import { sendOAuthWelcomeEmail } from "@/lib/email"
import { resolveAdapterMarket } from "@/lib/oauth-registration"
import {
    isLikelyFirstOauthSignIn,
    isOauthSignIn,
    isProviderEmailVerified,
    shouldSendOauthWelcomeEmail,
} from "@/lib/oauth-security"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { resolveAuthRedirectUrl } from "@/lib/app-origins"

const isDevelopment = process.env.NODE_ENV === "development";

if (isDevelopment) {
    console.log("[AUTH] Config - AUTH_URL:", process.env.AUTH_URL || process.env.NEXTAUTH_URL);
    console.log("[AUTH] Config - AUTH_SECRET set:", !!process.env.AUTH_SECRET);
    console.log("[AUTH] Config - AUTH_TRUST_HOST:", process.env.AUTH_TRUST_HOST);
}

// Build providers list dynamically to avoid errors when env vars are missing
const providers = []

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        })
    )
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
        GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        })
    )
}

providers.push(
    Credentials({
        name: "credentials",
        credentials: {
            email: { label: "Email", type: "email" },
            password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
            if (isDevelopment) console.log("[AUTH] Authorize called with email:", credentials?.email);
            const email = credentials?.email;
            const plainPassword = credentials?.password;
            if (typeof email !== 'string' || typeof plainPassword !== 'string') {
                if (isDevelopment) console.log("[AUTH] Invalid credentials type");
                return null;
            }

            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                if (isDevelopment) console.log("[AUTH] User not found in DB:", email);
                return null;
            }

            const isValid = await bcrypt.compare(plainPassword, user.password || "");
            if (!isValid) {
                if (isDevelopment) console.log("[AUTH] Invalid password for user:", email);
                return null;
            }

            if (user.disabledAt) {
                throw new CredentialsSignin("Conta desativada. Entre em contato com o suporte.");
            }

            if (isDevelopment) console.log("[AUTH] Login successful for user:", email);
            return user;
        },
    }),
);



function serializeNextAuthLogDetails(message: unknown[]): unknown {
    if (message.length === 0) return undefined;
    const mapOne = (item: unknown): unknown => {
        if (item instanceof Error) {
            return { name: item.name, message: item.message };
        }
        return item;
    };
    if (message.length === 1) return mapOne(message[0]);
    return message.map(mapOne);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: createProspectorAuthAdapter(prisma),
    providers,
    basePath: "/api/auth",
    trustHost: true,
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60,  // 30 days
    },
    callbacks: {
        async session({ session, token }) {
            if (!session.user) return session;
            if (token.id) session.user.id = String(token.id);
            if (token.email) session.user.email = String(token.email);
            if (!session.user.email && token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: String(token.id) },
                        select: { email: true, name: true, image: true },
                    });
                    if (dbUser?.email) {
                        session.user.email = dbUser.email;
                        if (dbUser.name != null) session.user.name = dbUser.name;
                        if (dbUser.image != null) session.user.image = dbUser.image;
                    }
                } catch (err) {
                    logger.error('Session callback user lookup failed', {
                        error: err instanceof Error ? err.message : 'Unknown',
                        userId: String(token.id),
                    });
                }
            }
            const role = (token.role as 'admin' | 'support' | null) ?? getPanelRole(session);
            (session.user as { role?: 'admin' | 'support' | null }).role = role;
            return session;
        },
        async redirect({ url, baseUrl }) {
            return resolveAuthRedirectUrl(url, baseUrl);
        },
        async signIn({ user, account, profile }) {
            if (!isOauthSignIn(account?.provider)) return true;
            if (!user?.email) return false;

            const dbUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { id: true, disabledAt: true, emailVerified: true, createdAt: true },
            });
            if (dbUser?.disabledAt) return false;

            const providerEmailVerified = isProviderEmailVerified(profile as Record<string, unknown> | null | undefined);
            const isFirstOauthSignIn = isLikelyFirstOauthSignIn(dbUser?.createdAt);

            if (dbUser?.id && providerEmailVerified && !dbUser.emailVerified) {
                await prisma.user
                    .update({
                        where: { id: dbUser.id },
                        data: { emailVerified: new Date() },
                    })
                    .catch((error: unknown) => {
                        logger.warn("OAuth emailVerified update failed", {
                            userId: dbUser.id,
                            email: user.email,
                            provider: account?.provider,
                            error: error instanceof Error ? error.message : "Unknown",
                        });
                    });
            }

            if (dbUser?.id) {
                prisma.auditLog
                    .create({
                        data: {
                            userId: dbUser.id,
                            adminEmail: user.email ?? undefined,
                            action: isFirstOauthSignIn ? "auth.oauth.signup" : "auth.oauth.login",
                            resource: "auth",
                            resourceId: dbUser.id,
                            details: {
                                provider: account?.provider ?? "unknown",
                                providerAccountId: account?.providerAccountId ?? null,
                                providerEmailVerified,
                            },
                        },
                    })
                    .catch(() => {});
            }

            if (isFirstOauthSignIn && shouldSendOauthWelcomeEmail(process.env.SEND_OAUTH_WELCOME_EMAIL)) {
                resolveAdapterMarket()
                    .then((market) =>
                        sendOAuthWelcomeEmail(
                            user.email!,
                            user.name ?? null,
                            account?.provider ?? "oauth",
                            market,
                        ),
                    )
                    .then((result) => {
                        if (!result.sent) {
                            logger.warn("OAuth welcome email not sent", {
                                email: user.email,
                                provider: account?.provider,
                                reason: result.error ?? "no-config",
                            });
                        }
                    })
                    .catch((error: unknown) => {
                        logger.warn("OAuth welcome email failed", {
                            email: user.email,
                            provider: account?.provider,
                            error: error instanceof Error ? error.message : "Unknown",
                        });
                    });
            }

            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email ?? token.email;
                token.name = user.name ?? token.name;
                token.picture = user.image ?? token.picture;
                token.role = getPanelRole({ user: { email: user.email ?? undefined }, expires: '' });
            }
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: String(token.id) },
                        select: { email: true, tokenVersion: true },
                    });
                    if (dbUser) {
                        if (dbUser.email) token.email = dbUser.email;
                        if (!token.role) {
                            token.role = getPanelRole({ user: { email: dbUser.email ?? undefined }, expires: '' });
                        }
                        token.tokenVersion = dbUser.tokenVersion;
                    }
                } catch (err) {
                    logger.error('JWT callback user lookup failed', {
                        error: err instanceof Error ? err.message : 'Unknown',
                        userId: String(token.id),
                    });
                }
            }
            return token;
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
    cookies: {
        sessionToken: {
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: true,
            },
        },
        callbackUrl: {
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: true,
            },
        },
        csrfToken: {
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: true,
            },
        },
    },
    debug: isDevelopment,
    logger: {
        error(code, ...message) {
            logger.error('NextAuth error', {
                code: String(code),
                route: '/api/auth',
                ...(String(code) === 'CredentialsSignin' || String(code).includes('CredentialsSignin')
                    ? { reason: 'credentials_signin_failed' }
                    : {}),
                details: serializeNextAuthLogDetails(message),
            });
        },
        warn(code, ...message) {
            logger.warn('NextAuth warning', { code: String(code), details: serializeNextAuthLogDetails(message) });
        },
        debug(code, ...message) {
            if (isDevelopment) {
                logger.info('NextAuth debug', { code: String(code), details: serializeNextAuthLogDetails(message) });
            }
        },
    }
})
