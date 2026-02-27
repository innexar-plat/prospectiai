import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { verifyTotpToken } from '@/lib/twofa';
import { twoFaCodeSchema, formatZodError } from '@/lib/validations/schemas';
import { logger } from '@/lib/logger';

/**
 * POST /api/auth/2fa/disable
 * Verify TOTP code and clear 2FA (twoFactorSecret = null, twoFactorEnabled = false).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = twoFaCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    const { code } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
    }

    const valid = verifyTotpToken(user.twoFactorSecret, code);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: null, twoFactorEnabled: false },
    });

    return NextResponse.json({ message: '2FA disabled successfully' });
  } catch (error) {
    logger.error('2FA disable error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
