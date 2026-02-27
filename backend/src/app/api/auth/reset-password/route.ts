import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { rateLimit } from "@/lib/ratelimit"
import { resetSchema, formatZodError } from "@/lib/validations/schemas"

export async function POST(req: Request) {
    try {
        const ip = req.headers.get("x-forwarded-for") || "127.0.0.1"
        const { success } = await rateLimit(`reset-password:${ip}`, 10, 3600) // 10 per hour

        if (!success) {
            return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
        }

        const body = await req.json()
        const parsed = resetSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 })
        }

        const { token, password } = parsed.data

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpires: {
                    gt: new Date()
                }
            }
        })

        if (!user) {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetToken: null,
                resetTokenExpires: null
            }
        })

        return NextResponse.json({ message: "Password updated successfully" })
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Reset password error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
