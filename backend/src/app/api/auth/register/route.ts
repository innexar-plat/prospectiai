import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { rateLimit } from "@/lib/ratelimit"
import { sendVerificationEmail } from "@/lib/email"
import { registerSchema, formatZodError } from "@/lib/validations/schemas"
import { logger } from "@/lib/logger"
import { attachReferralOnSignup } from "@/lib/affiliate"
import { notifyNewSignup } from '@/lib/telegram-business-alerts'
import { buildRegistrationUserData, buildRegistrationWorkspaceData } from '@/lib/registration'
import { getRequestLocale } from '@/lib/i18n/locale'
import { getRequestMarket } from '@/lib/market'
import { getSiteUrlFromRequest } from '@/lib/site-url'
import { tApiError } from '@/lib/i18n/messages'

/**
 * POST /api/auth/register
 * Cria usuário + workspace padrão em transação.
 * Usuário só acessa o dashboard após concluir onboarding (onboardingCompletedAt).
 */
export async function POST(req: Request) {
    const locale = getRequestLocale(req);
    const market = getRequestMarket(req);
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
        const { success } = await rateLimit(`register:${ip}`, 5, 3600) // 5 per hour

        if (!success) {
            return NextResponse.json({ error: tApiError(locale, 'tooManyRequests') }, { status: 429 })
        }

        const body = await req.json()
        const parsed = registerSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 })
        }
        const { email, password, name, affiliateCode } = parsed.data

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ error: tApiError(locale, 'emailInUse') }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const regUser = buildRegistrationUserData(market)
        const workspaceName = (name && name.trim()) ? `${name.trim()} - Workspace` : "Meu Workspace"

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    ...regUser,
                }
            })

            const workspace = await tx.workspace.create({
                data: buildRegistrationWorkspaceData(workspaceName, market),
            })

            await tx.workspaceMember.create({
                data: {
                    userId: user.id,
                    workspaceId: workspace.id,
                    role: "OWNER",
                }
            })

            return { user, workspace }
        })

        // Atribuição afiliado: criar Referral se código válido e não auto-indicação (fora da tx)
        if (affiliateCode) {
            await attachReferralOnSignup({
                affiliateCode,
                userId: result.user.id,
                workspaceId: result.workspace.id,
                email,
            });
        }

        const verifyToken = crypto.randomBytes(32).toString("hex")
        const verifyExpires = new Date(Date.now() + 86400000) // 24h
        await prisma.verificationToken.create({
            data: { identifier: email, token: verifyToken, expires: verifyExpires },
        })

        const siteUrl = getSiteUrlFromRequest(req)
        const verificationEmailResult = await sendVerificationEmail(email, verifyToken, locale, siteUrl)
        if (!verificationEmailResult.sent) {
            logger.error('Initial verification email failed after register', {
                email,
                userId: result.user.id,
                error: verificationEmailResult.error ?? 'Unknown error',
            })
        }

        notifyNewSignup({
            userId: result.user.id,
            userEmail: email,
            userName: name,
            workspaceId: result.workspace.id,
            verificationEmailSent: verificationEmailResult.sent,
        })

        return NextResponse.json({
            message: "User created successfully",
            id: result.user.id,
            requiresOnboarding: true,
            verificationEmailSent: verificationEmailResult.sent,
            verificationEmailError: verificationEmailResult.sent
                ? null
                : (verificationEmailResult.error ?? 'Falha ao enviar e-mail de confirmação.'),
        })
    } catch (error) {
        logger.error("Registration error", { error: error instanceof Error ? error.message : "Unknown" })
        return NextResponse.json({ error: tApiError(locale, 'internalError') }, { status: 500 })
    }
}
