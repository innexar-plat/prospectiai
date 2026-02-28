import NextAuth, { type Session, CredentialsSignin } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { getPanelRole } from "@/lib/admin"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

console.log("[AUTH] Config - AUTH_URL:", process.env.AUTH_URL || process.env.NEXTAUTH_URL);
console.log("[AUTH] Config - AUTH_SECRET set:", !!process.env.AUTH_SECRET);
console.log("[AUTH] Config - AUTH_TRUST_HOST:", process.env.AUTH_TRUST_HOST);

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
            console.log("[AUTH] Authorize called with email:", credentials?.email);
            const email = credentials?.email;
            const plainPassword = credentials?.password;
            if (typeof email !== 'string' || typeof plainPassword !== 'string') {
                console.log("[AUTH] Invalid credentials type");
                return null;
            }

            const user = await prisma.user.findUnique({
                where: { email },
            });

            if (!user) {
                console.log("[AUTH] User not found in DB:", email);
                return null;
            }

            const isValid = await bcrypt.compare(plainPassword, user.password || "");
            if (!isValid) {
                console.log("[AUTH] Invalid password for user:", email);
                return null;
            }

            if (user.disabledAt) {
                throw new CredentialsSignin("Conta desativada. Entre em contato com o suporte.");
            }

            console.log("[AUTH] Login successful for user:", email);
            return user;
        },
    }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    providers,
    basePath: "/api/auth",
    trustHost: true,
    session: { strategy: "jwt" },
    callbacks: {
        async session({ session, token }) {
            if (!session.user) return session;
            if (token.id) session.user.id = token.id as string;
            if (token.email) session.user.email = token.email as string;
            if (!session.user.email && token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { email: true, name: true, image: true },
                });
                if (dbUser?.email) {
                    session.user.email = dbUser.email;
                    if (dbUser.name != null) session.user.name = dbUser.name;
                    if (dbUser.image != null) session.user.image = dbUser.image;
                }
            }
            const role = (token.role as 'admin' | 'support' | null) ?? getPanelRole(session);
            (session.user as { role?: 'admin' | 'support' | null }).role = role;
            return session;
        },
        async redirect({ url, baseUrl }) {
            const base = baseUrl.replace(/\/$/, "");
            if (url.startsWith("/")) return `${base}${url}`;
            try {
                if (new URL(url).origin === base) return url;
            } catch {
                return base;
            }
            return base;
        },
        async signIn({ user, account }) {
            if (account?.provider === "credentials") return true;
            if (!user?.email) return false;
            const dbUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { disabledAt: true },
            });
            if (dbUser?.disabledAt) return false;
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email ?? token.email;
                token.name = user.name ?? token.name;
                token.picture = user.image ?? token.picture;
                token.role = getPanelRole({ user: { email: user.email ?? undefined } } as Session);
            }
            if (!token.role && token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { email: true },
                });
                if (dbUser?.email) {
                    token.email = dbUser.email;
                    token.role = getPanelRole({ user: { email: dbUser.email } } as Session);
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
    debug: true,
    logger: {
        error(code, ...message) { console.error("[AUTH] ERROR:", code, message) },
        warn(code, ...message) { console.warn("[AUTH] WARN:", code, message) },
        debug(code, ...message) { console.log("[AUTH] DEBUG:", code, message) },
    }
})
