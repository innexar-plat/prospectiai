import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { rateLimit } from "@/lib/ratelimit"
import { forgotSchema, formatZodError } from "@/lib/validations/schemas"
import { sendPasswordResetEmail } from "@/lib/email"

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
        const { success } = await rateLimit(`forgot-password:${ip}`, 3, 3600) // 3 per hour

        if (!success) {
            return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
        }

        const body = await req.json()
        const parsed = forgotSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 })
        }

        const { email } = parsed.data

        const user = await prisma.user.findUnique({
            where: { email }
        })

        // For security reasons, don't reveal if the user exists
        if (!user) {
            return NextResponse.json({ message: "If that email exists, a reset link has been sent." })
        }

        const token = crypto.randomBytes(32).toString("hex")
        const expires = new Date(Date.now() + 3600000) // 1 hour from now

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: token,
                resetTokenExpires: expires
            }
        })

        const { sent } = await sendPasswordResetEmail(user.email!, token);
        const { logger } = await import('@/lib/logger');
        if (!sent && process.env.NODE_ENV === 'development') logger.info('Password reset link generated (email not sent)', { hasToken: !!token });

        return NextResponse.json({
            message: "If that email exists, a reset link has been sent.",
            devToken: process.env.NODE_ENV === 'development' && !sent ? token : undefined
        })
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Forgot password error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
