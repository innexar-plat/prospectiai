import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { tokenVersion: { increment: 1 } },
        })

        return NextResponse.json({ message: "Logged out successfully" })
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Logout error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
