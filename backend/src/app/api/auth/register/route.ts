import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { rateLimit } from "@/lib/ratelimit"
import { sendVerificationEmail } from "@/lib/email"
import { registerSchema, formatZodError } from "@/lib/validations/schemas"
import { logger } from "@/lib/logger"

/**
 * POST /api/auth/register
 * Cria usuário + workspace padrão em transação.
 * Usuário só acessa o dashboard após concluir onboarding (onboardingCompletedAt).
 */
export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
        const { success } = await rateLimit(`register:${ip}`, 5, 3600) // 5 per hour

        if (!success) {
            return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
        }

        const body = await req.json()
        const parsed = registerSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 })
        }
        const { email, password, name } = parsed.data

        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            return NextResponse.json({ error: "Email already in use" }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                    plan: "FREE",
                    leadsLimit: 10,
                    leadsUsed: 0,
                }
            })

            const workspace = await tx.workspace.create({
                data: {
                    name: (name && name.trim()) ? `${name.trim()} - Workspace` : "Meu Workspace",
                    plan: "FREE",
                    leadsLimit: 10,
                    leadsUsed: 0,
                }
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

        const verifyToken = crypto.randomBytes(32).toString("hex")
        const verifyExpires = new Date(Date.now() + 86400000) // 24h
        await prisma.verificationToken.create({
            data: { identifier: email, token: verifyToken, expires: verifyExpires },
        })
        sendVerificationEmail(email, verifyToken).catch(() => {})

        return NextResponse.json({
            message: "User created successfully",
            id: result.user.id,
            requiresOnboarding: true,
        })
    } catch (error) {
        logger.error("Registration error", { error: error instanceof Error ? error.message : "Unknown" })
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
