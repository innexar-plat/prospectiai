import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { createRepresentative } from '@/lib/representative';
import { sendRepresentativeInviteEmail, sendRepresentativePromotedEmail } from '@/lib/email';
import { getSiteUrlFromRequest } from '@/lib/site-url';
import { getRequestLocale } from '@/lib/i18n/locale';
import { getRequestMarket } from '@/lib/market';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const postSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  document: z.string().max(50).optional(),
  directCommissionPercent: z.number().min(0).max(100).optional(),
  affiliateOverridePercent: z.number().min(0).max(100).optional(),
  holdDays: z.number().int().min(0).max(365).optional(),
  creditsLimit: z.number().int().min(0).optional(),
  level: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  region: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  payoutType: z.enum(['PIX', 'BANK_TRANSFER']).optional(),
  payoutPayload: z.string().max(2000).optional(),
  minPayoutCents: z.number().int().min(0).optional(),
  monthlyGoal: z.number().int().min(0).optional(),
  /** Market for a brand-new account. Falls back to the admin's own request host if omitted. */
  market: z.enum(['BR', 'US']).optional(),
});

const repStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
const repLevelEnum = z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);

const getQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: repStatusEnum.optional(),
  level: repLevelEnum.optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parsed = getQuerySchema.safeParse({
    limit: req.nextUrl.searchParams.get('limit') ?? 20,
    offset: req.nextUrl.searchParams.get('offset') ?? 0,
    status: req.nextUrl.searchParams.get('status') ?? undefined,
    level: req.nextUrl.searchParams.get('level') ?? undefined,
    search: req.nextUrl.searchParams.get('search') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { limit, offset, status, level, search } = parsed.data;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (level) where.level = level;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.representative.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        level: true,
        status: true,
        directCommissionPct: true,
        affiliateOverridePct: true,
        creditLimit: true,
        region: true,
        lastActivityAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { clients: true, commissions: true, affiliates: true } },
      },
    }),
    prisma.representative.count({ where }),
  ]);

  const list = items.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    level: r.level,
    status: r.status,
    creditsUsed: 0,
    creditsLimit: r.creditLimit,
    phone: r.phone,
    region: r.region,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    lastActivityAt: r.lastActivityAt?.toISOString() ?? null,
    _count: {
      clients: r._count.clients,
      commissions: r._count.commissions,
      affiliates: r._count.affiliates,
    },
  }));

  return NextResponse.json({ items: list, total, limit, offset });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const { directCommissionPercent, affiliateOverridePercent, holdDays, creditsLimit, monthlyGoal, market, ...rest } = parsed.data;

  try {
    const { rep, accountCreated, resetToken } = await createRepresentative({
      ...rest,
      directCommissionPct: directCommissionPercent,
      affiliateOverridePct: affiliateOverridePercent,
      commissionHoldDays: holdDays,
      creditLimit: creditsLimit,
      monthlyGoalCents: monthlyGoal,
      market: market ?? getRequestMarket(req),
    }, session.user.id);

    const baseUrl = getSiteUrlFromRequest(req).replace(/\/$/, '');
    const locale = getRequestLocale(req);

    if (accountCreated && resetToken) {
      const setPasswordUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
      sendRepresentativeInviteEmail(rep.email, setPasswordUrl, locale, baseUrl)
        .then((res) => {
          if (!res.sent) logger.warn('Representative invite email not sent', { email: rep.email, reason: res.error ?? 'no config' });
        })
        .catch((err) => logger.error('Representative invite email failed', { email: rep.email, error: err instanceof Error ? err.message : 'Unknown' }));
    } else {
      const dashboardUrl = `${baseUrl}/dashboard`;
      sendRepresentativePromotedEmail(rep.email, dashboardUrl, locale, baseUrl)
        .then((res) => {
          if (!res.sent) logger.warn('Representative promoted email not sent', { email: rep.email, reason: res.error ?? 'no config' });
        })
        .catch((err) => logger.error('Representative promoted email failed', { email: rep.email, error: err instanceof Error ? err.message : 'Unknown' }));
    }

    return NextResponse.json({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      level: rep.level,
      status: rep.status,
      accountCreated,
      message: accountCreated
        ? 'Representante criado com sucesso. Convite enviado por e-mail.'
        : 'Cliente existente promovido a representante com sucesso.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
