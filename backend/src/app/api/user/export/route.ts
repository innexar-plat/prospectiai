/**
 * GET /api/user/export — LGPD/GDPR data export
 * Returns all personal data associated with the authenticated user.
 */
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
            type: true,
          },
        },
        workspaces: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                plan: true,
                createdAt: true,
              },
            },
          },
        },
        analyses: {
          select: {
            id: true,
            createdAt: true,
            score: true,
            scoreLabel: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        },
        searchHistory: {
          select: {
            id: true,
            textQuery: true,
            city: true,
            state: true,
            resultsCount: true,
            createdAt: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        },
        notifications: {
          select: {
            id: true,
            title: true,
            message: true,
            type: true,
            createdAt: true,
            readAt: true,
          },
          take: 500,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Strip sensitive fields
    const exportData = {
      meta: {
        exportedAt: new Date().toISOString(),
        format: 'LGPD/GDPR Personal Data Export',
        userId: user.id,
      },
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        phone: user.phone,
        address: user.address,
        companyName: user.companyName,
        productService: user.productService,
        targetAudience: user.targetAudience,
        mainBenefit: user.mainBenefit,
        linkedInUrl: user.linkedInUrl,
        instagramUrl: user.instagramUrl,
        facebookUrl: user.facebookUrl,
        websiteUrl: user.websiteUrl,
        onboardingCompletedAt: user.onboardingCompletedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        notifyByEmail: user.notifyByEmail,
        notifyWeeklyReport: user.notifyWeeklyReport,
        notifyLeadAlerts: user.notifyLeadAlerts,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      billing: {
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        currentPeriodEnd: user.currentPeriodEnd,
      },
      connectedAccounts: user.accounts,
      workspaces: user.workspaces.map((wm) => ({
        role: wm.role,
        workspace: wm.workspace,
      })),
      analyses: user.analyses,
      searchHistory: user.searchHistory,
      notifications: user.notifications,
    };

    logger.info('LGPD data export requested', { userId });

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="precisionia-data-export-${userId}.json"`,
      },
    });
  } catch (error) {
    logger.error('LGPD data export failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Erro ao exportar dados' }, { status: 500 });
  }
}
