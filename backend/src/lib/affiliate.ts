/**
 * Lógica de afiliados: busca por código, settings, criação de comissão com antifraude.
 */
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { Affiliate, Referral, AffiliateCommissionStatus } from '@prisma/client';

const AFFILIATE_SETTINGS_ID = 'affiliate-settings-default';

export type AffiliateSettingsRow = {
  defaultCommissionRatePercent: number;
  cookieDurationDays: number;
  commissionRule: string;
  approvalHoldDays: number;
  minPayoutCents: number;
  allowSelfSignup: boolean;
};

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return prisma.affiliate.findFirst({
    where: { code: trimmed, status: 'APPROVED' },
  });
}

export async function getOrCreateSettings(): Promise<AffiliateSettingsRow> {
  let row = await prisma.affiliateSettings.findUnique({
    where: { id: AFFILIATE_SETTINGS_ID },
  });
  if (!row) {
    row = await prisma.affiliateSettings.create({
      data: {
        id: AFFILIATE_SETTINGS_ID,
        defaultCommissionRatePercent: 20,
        cookieDurationDays: 30,
        commissionRule: 'FIRST_PAYMENT_ONLY',
        approvalHoldDays: 15,
        minPayoutCents: 10000,
        allowSelfSignup: true,
      },
    });
  }
  return {
    defaultCommissionRatePercent: row.defaultCommissionRatePercent,
    cookieDurationDays: row.cookieDurationDays,
    commissionRule: row.commissionRule,
    approvalHoldDays: row.approvalHoldDays,
    minPayoutCents: row.minPayoutCents,
    allowSelfSignup: row.allowSelfSignup,
  };
}

/** Bloqueia auto-indicação: mesmo email afiliado e usuário. */
export async function isSelfReferral(affiliateId: string, userEmail: string | null): Promise<boolean> {
  if (!userEmail) return false;
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { email: true, userId: true, user: { select: { email: true } } },
  });
  if (!aff) return true; // desconhecido = não criar comissão
  const affiliateEmail = aff.email ?? aff.user?.email ?? null;
  if (!affiliateEmail) return false;
  return affiliateEmail.toLowerCase() === userEmail.toLowerCase();
}

/**
 * Cria comissão para um referral na primeira conversão (pagamento aprovado).
 * Retorna a comissão criada ou null se bloqueada (auto-referral, já convertido, etc).
 */
export async function createCommissionForFirstPayment(params: {
  userId: string;
  workspaceId: string;
  userEmail: string | null;
  planId: string;
  valueCents: number;
  currency?: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  affiliateCodeFromMetadata?: string | null;
}): Promise<{ id: string } | null> {
  const { userId, workspaceId, userEmail, planId, valueCents, currency = 'BRL', orderId, subscriptionId, affiliateCodeFromMetadata } = params;
  const settings = await getOrCreateSettings();

  // 1. Buscar referral existente por userId ou workspaceId
  let referral = await prisma.referral.findFirst({
    where: { OR: [{ userId }, { workspaceId }] },
    orderBy: { createdAt: 'desc' },
    include: { affiliate: true },
  });

  // 2. Se não tem referral, tentar criar tardio pelo metadata (backup do checkout)
  if (!referral && affiliateCodeFromMetadata) {
    const affiliate = await getAffiliateByCode(affiliateCodeFromMetadata);
    if (affiliate) {
      const selfRef = await isSelfReferral(affiliate.id, userEmail);
      if (!selfRef) {
        referral = await prisma.referral.create({
          data: {
            affiliateId: affiliate.id,
            userId,
            workspaceId,
            landedAt: new Date(),
            signupAt: new Date(),
            refSource: 'METADATA',
          },
          include: { affiliate: true },
        });
      }
    }
  }

  if (!referral) return null;
  if (referral.convertedAt != null) return null; // já converteu, não duplicar primeira comissão
  if (referral.affiliate.status !== 'APPROVED') return null;

  const selfRef = await isSelfReferral(referral.affiliateId, userEmail);
  if (selfRef) return null;

  const rate = referral.affiliate.commissionRatePercent;
  const amountCents = Math.floor((valueCents * rate) / 100);
  if (amountCents <= 0) return null;

  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() + settings.approvalHoldDays);

  const [commission] = await prisma.$transaction([
    prisma.affiliateCommission.create({
      data: {
        affiliateId: referral.affiliateId,
        referralId: referral.id,
        workspaceId,
        amountCents,
        currency,
        orderId: orderId ?? undefined,
        subscriptionId: subscriptionId ?? undefined,
        status: 'PENDING',
        availableAt,
        commissionType: 'FIRST_PAYMENT',
      },
    }),
    prisma.referral.update({
      where: { id: referral.id },
      data: {
        convertedAt: new Date(),
        firstPaidAt: new Date(),
        planId,
        valueCents,
      },
    }),
  ]);

  const affiliateEmail = await getAffiliateEmail(referral.affiliateId);
  if (affiliateEmail) {
    const base = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const dashboardUrl = `${base.replace(/\/$/, '')}/dashboard/afiliado`;
    import('@/lib/email').then(({ sendAffiliateConversionEmail }) => {
      sendAffiliateConversionEmail(
        affiliateEmail,
        'Um indicado seu realizou a primeira assinatura paga. A comissão foi registrada e estará disponível após o período de segurança.',
        dashboardUrl
      ).catch((e: unknown) => {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Affiliate conversion email failed', { error: e instanceof Error ? e.message : 'Unknown' });
        });
      });
    });
  }
  return { id: commission.id };
}

async function getAffiliateEmail(affiliateId: string): Promise<string | null> {
  const aff = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { email: true, user: { select: { email: true } } },
  });
  return aff?.email ?? aff?.user?.email ?? null;
}

/** Generates a cryptographically secure 8-char affiliate code (no ambiguous chars: 0/O, 1/I/L). */
export async function generateAffiliateCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomInt(0, chars.length));
  }
  const exists = await prisma.affiliate.findUnique({ where: { code } });
  if (exists) return generateAffiliateCode();
  return code;
}

/**
 * Atualiza comissões PENDING para APPROVED quando availableAt <= now.
 * Chamar via cron ou ao listar comissões no admin.
 */
export async function approveCommissionsByAvailableAt(): Promise<number> {
  const now = new Date();
  const result = await prisma.affiliateCommission.updateMany({
    where: { status: 'PENDING', availableAt: { lte: now } },
    data: { status: 'APPROVED' },
  });
  return result.count;
}

/**
 * Cancela comissões relacionadas a um pedido ou assinatura (refund/chargeback).
 */
export async function cancelCommissionsByOrderOrSubscription(
  orderId?: string | null,
  subscriptionId?: string | null
): Promise<number> {
  if (!orderId && !subscriptionId) return 0;
  const where: { status: { in: ('PENDING' | 'APPROVED')[] }; OR: Array<{ orderId?: string; subscriptionId?: string }> } = {
    status: { in: ['PENDING', 'APPROVED'] },
    OR: [],
  };
  if (orderId) where.OR.push({ orderId });
  if (subscriptionId) where.OR.push({ subscriptionId });
  const result = await prisma.affiliateCommission.updateMany({
    where,
    data: { status: 'CANCELLED' },
  });
  return result.count;
}

/**
 * Cria comissão recorrente para um workspace já convertido (renovação de assinatura).
 * Só cria se config commissionRule === 'RECURRING'. orderId evita duplicata (idempotência).
 */
export async function createCommissionForRecurring(params: {
  workspaceId: string;
  subscriptionId: string;
  planId: string;
  valueCents: number;
  currency?: string;
  orderId?: string | null;
}): Promise<{ id: string } | null> {
  const { workspaceId, subscriptionId, planId, valueCents, currency = 'BRL', orderId } = params;
  const settings = await getOrCreateSettings();
  if (settings.commissionRule !== 'RECURRING') return null;
  if (orderId) {
    const existing = await prisma.affiliateCommission.findFirst({
      where: { orderId, workspaceId },
    });
    if (existing) return null;
  }
  const referral = await prisma.referral.findFirst({
    where: { workspaceId, convertedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { affiliate: true },
  });
  if (!referral || referral.affiliate.status !== 'APPROVED') return null;
  const existingCount = await prisma.affiliateCommission.count({
    where: { workspaceId, subscriptionId },
  });
  if (existingCount === 0) return null;
  const rate = referral.affiliate.commissionRatePercent;
  const amountCents = Math.floor((valueCents * rate) / 100);
  if (amountCents <= 0) return null;
  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() + settings.approvalHoldDays);
  const commission = await prisma.affiliateCommission.create({
    data: {
      affiliateId: referral.affiliateId,
      referralId: referral.id,
      workspaceId,
      amountCents,
      currency,
      orderId: orderId ?? undefined,
      subscriptionId,
      status: 'PENDING',
      availableAt,
      commissionType: 'RECURRING',
    },
  });
  const affiliateEmail = await getAffiliateEmail(referral.affiliateId);
  if (affiliateEmail) {
    const base = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const dashboardUrl = `${base.replace(/\/$/, '')}/dashboard/afiliado`;
    import('@/lib/email').then(({ sendAffiliateConversionEmail }) => {
      sendAffiliateConversionEmail(
        affiliateEmail,
        'Um indicado seu renovou a assinatura. Nova comissão recorrente foi registrada.',
        dashboardUrl
      ).catch((e: unknown) => {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Affiliate recurring conversion email failed', { error: e instanceof Error ? e.message : 'Unknown' });
        });
      });
    });
  }
  return { id: commission.id };
}
