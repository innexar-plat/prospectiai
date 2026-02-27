import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

// This is a one-time migration script to transition from User-based billing to Workspace-based billing.
// It creates a Workspace for every existing user, links them as OWNER, and maps their Analysis history.
// Protegido: apenas admin (ADMIN_EMAILS) pode executar.
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdmin(session)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const users = await prisma.user.findMany({
            include: { workspaces: true }
        });

        let migratedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            // Check if user already has a workspace
            if (user.workspaces.length > 0) {
                skippedCount++;
                continue;
            }

            // Execute the migration for this user within a transaction to ensure data integrity
            await prisma.$transaction(async (tx) => {
                // 1. Create the Workspace copying the user's current billing state
                const workspace = await tx.workspace.create({
                    data: {
                        name: `${user.name || 'User'}'s Workspace`,
                        plan: user.plan || 'FREE',
                        subscriptionId: user.subscriptionId,
                        customerId: user.customerId,
                        subscriptionStatus: user.subscriptionStatus,
                        currentPeriodEnd: user.currentPeriodEnd,
                        leadsLimit: user.leadsLimit ?? 10,
                        leadsUsed: user.leadsUsed ?? 0,
                    }
                });

                // 2. Link the user as the OWNER of this new Workspace
                await tx.workspaceMember.create({
                    data: {
                        workspaceId: workspace.id,
                        userId: user.id,
                        role: 'OWNER'
                    }
                });

                // 3. Migrate all existing LeadAnalysis records to point to this new Workspace
                await tx.leadAnalysis.updateMany({
                    where: { userId: user.id },
                    data: { workspaceId: workspace.id }
                });
            });

            migratedCount++;
        }

        return NextResponse.json({
            success: true,
            migrated: migratedCount,
            skipped: skippedCount,
            message: 'Database Workspace Migration Complete.'
        });

    } catch (error: unknown) {
        const { logger } = await import('@/lib/logger');
        const message = error instanceof Error ? error.message : 'Unknown';
        logger.error('Workspace Migration Error', { error: message });
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
