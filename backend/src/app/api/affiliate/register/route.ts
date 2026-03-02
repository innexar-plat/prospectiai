import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateAffiliateCode, getOrCreateSettings } from '@/lib/affiliate';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getOrCreateSettings();
  if (!settings.allowSelfSignup) return NextResponse.json({ error: 'Self signup is disabled' }, { status: 403 });
  const existing = await prisma.affiliate.findFirst({
    where: { userId: session.user.id },
    select: { id: true, code: true, status: true },
  });
  if (existing) return NextResponse.json({ id: existing.id, code: existing.code, status: existing.status, message: 'Already registered as affiliate' });
  const code = await generateAffiliateCode();
  const affiliate = await prisma.affiliate.create({
    data: {
      code: code.toUpperCase(),
      status: 'PENDING',
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
      commissionRatePercent: settings.defaultCommissionRatePercent,
    },
  });
  return NextResponse.json({
    id: affiliate.id, code: affiliate.code, status: affiliate.status,
    message: 'Affiliate registration created. Awaiting approval.',
  });
}
