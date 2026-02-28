import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { onboardingCompleteSchema, formatZodError } from "@/lib/validations/schemas"
import { logger } from "@/lib/logger"

/**
 * POST /api/onboarding/complete
 * Conclui o onboarding: atualiza perfil do negócio e marca onboardingCompletedAt.
 * Após isso o usuário pode acessar o dashboard (busca baseada nesses dados).
 *
 * Body: { companyName?, productService?, targetAudience?, mainBenefit? }
 */
export async function POST(req: Request) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const parsed = onboardingCompleteSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 })
        }
        const { companyName, productService, targetAudience, mainBenefit } = parsed.data

        let membership = await prisma.workspaceMember.findFirst({
            where: { userId: session.user.id },
            select: { workspaceId: true },
        })
        if (!membership) {
            const existingUser = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { name: true },
            })
            const userName = existingUser?.name ?? null
            const workspaceName = (userName && String(userName).trim())
                ? `${String(userName).trim()} - Workspace`
                : "Meu Workspace"
            await prisma.$transaction(async (tx) => {
                const workspace = await tx.workspace.create({
                    data: { name: workspaceName, plan: "FREE", leadsLimit: 10, leadsUsed: 0 },
                })
                await tx.workspaceMember.create({
                    data: { userId: session.user.id!, workspaceId: workspace.id, role: "OWNER" },
                })
            })
            membership = await prisma.workspaceMember.findFirst({
                where: { userId: session.user.id },
                select: { workspaceId: true },
            })
        }

        if (!membership) {
            return NextResponse.json({ error: "Workspace membership not found" }, { status: 500 })
        }
        const workspaceId = membership.workspaceId
        await Promise.all([
            prisma.user.update({
                where: { id: session.user.id },
                data: { onboardingCompletedAt: new Date() },
            }),
            prisma.workspace.update({
                where: { id: workspaceId },
                data: {
                    companyName: companyName ?? undefined,
                    productService: productService ?? undefined,
                    targetAudience: targetAudience ?? undefined,
                    mainBenefit: mainBenefit ?? undefined,
                },
            }),
        ])

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { onboardingCompletedAt: true },
        })

        return NextResponse.json({
            message: "Onboarding completed",
            onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
        })
    } catch (error) {
        logger.error("Onboarding complete error", { error: error instanceof Error ? error.message : "Unknown" })
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
