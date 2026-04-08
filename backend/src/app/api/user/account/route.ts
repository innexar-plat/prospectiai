/**
 * DELETE /api/user/account — LGPD/GDPR account deletion
 * Soft-deletes the user account (sets disabledAt + anonymizes data).
 * Data is retained for 30 days before hard deletion via cron.
 *
 * POST /api/user/account — Request account deletion (sends confirmation email)
 */
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { alertWarning } from '@/lib/telegram-alert';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, disabledAt: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (user.disabledAt) {
      return NextResponse.json({
        message: 'Conta já está em processo de exclusão',
        scheduledDeletion: new Date(user.disabledAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    const now = new Date();

    // Soft delete: disable the account + anonymize personal data
    await prisma.$transaction([
      // Disable account
      prisma.user.update({
        where: { id: userId },
        data: {
          disabledAt: now,
          // Anonymize PII but keep record for 30 days
          name: '[Conta excluída]',
          phone: null,
          address: null,
          linkedInUrl: null,
          instagramUrl: null,
          facebookUrl: null,
          websiteUrl: null,
          image: null,
          // Clear CRM tokens
          rdStationToken: null,
          rdStationRefreshToken: null,
          rdStationTokenExpiresAt: null,
          hubspotToken: null,
          hubspotRefreshToken: null,
          hubspotTokenExpiresAt: null,
          agendorApiTokenEncrypted: null,
          // Clear 2FA
          twoFactorSecret: null,
          twoFactorEnabled: false,
        },
      }),
      // Remove all sessions (force logout)
      prisma.session.deleteMany({ where: { userId } }),
      // Remove push subscriptions
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      // Remove OAuth accounts (can't login anymore)
      prisma.account.deleteMany({ where: { userId } }),
    ]);

    logger.info('Account deletion requested (LGPD)', { userId, email: user.email });

    // Notify via Telegram
    alertWarning(
      'Exclusão de conta LGPD',
      `Usuário solicitou exclusão de conta`,
      {
        userId,
        email: user.email ?? 'N/A',
        scheduledPurge: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }
    ).catch(() => {});

    // Try to send confirmation email
    try {
      const { sendEmail } = await import('@/lib/email');
      if (user.email) {
        await sendEmail(
          user.email,
          'Sua conta PrecisionAI foi desativada',
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2>Conta desativada</h2>
            <p>Sua conta no PrecisionAI foi desativada conforme solicitado.</p>
            <p>Seus dados pessoais foram anonimizados imediatamente. O registro será permanentemente removido em <strong>30 dias</strong>.</p>
            <p>Se isso foi um engano, entre em contato com nosso suporte antes desse prazo para reverter.</p>
            <p style="color:#666;font-size:12px">Esta ação foi realizada em conformidade com a LGPD (Lei Geral de Proteção de Dados).</p>
          </div>`
        );
      }
    } catch {
      // Email is best-effort
    }

    return NextResponse.json({
      message: 'Conta desativada com sucesso',
      details: 'Dados pessoais anonimizados. Registro será permanentemente excluído em 30 dias.',
      scheduledDeletion: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    logger.error('Account deletion failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Erro ao excluir conta' }, { status: 500 });
  }
}
