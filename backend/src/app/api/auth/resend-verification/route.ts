import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { getRequestLocale } from '@/lib/i18n/locale';
import { getSiteUrlFromRequest } from '@/lib/site-url';

const COOLDOWN_SECONDS = 60;

/**
 * POST /api/auth/resend-verification
 * Resends verification email for the currently authenticated user.
 * Rate-limited to 1 request per 60 seconds per user.
 */
export async function POST(req: Request) {
    const locale = getRequestLocale(req);
    const siteUrl = getSiteUrlFromRequest(req);
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        const email = session.user.email;

        // Check if user already verified
        const user = await prisma.user.findUnique({
            where: { email },
            select: { emailVerified: true },
        });
        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }
        if (user.emailVerified) {
            return NextResponse.json({ error: 'E-mail já verificado' }, { status: 400 });
        }

        // Rate limit: check if a token was created recently
        const recentToken = await prisma.verificationToken.findFirst({
            where: {
                identifier: email,
                expires: { gt: new Date() },
            },
            orderBy: { expires: 'desc' },
        });

        if (recentToken) {
            // Token expires 24h after creation, so creation time = expires - 24h
            const createdAt = new Date(recentToken.expires.getTime() - 86400000);
            const secondsSinceCreation = (Date.now() - createdAt.getTime()) / 1000;
            if (secondsSinceCreation < COOLDOWN_SECONDS) {
                const remaining = Math.ceil(COOLDOWN_SECONDS - secondsSinceCreation);
                return NextResponse.json(
                    { error: `Aguarde ${remaining} segundos antes de reenviar`, cooldown: remaining },
                    { status: 429 },
                );
            }
        }

        // Delete old tokens for this user
        await prisma.verificationToken.deleteMany({
            where: { identifier: email },
        });

        // Create new token (24h expiry)
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 86400000);
        await prisma.verificationToken.create({
            data: { identifier: email, token, expires },
        });

        // Send email (fire-and-forget but still await for error reporting)
        const result = await sendVerificationEmail(email, token, locale, siteUrl);
        if (!result.sent) {
            logger.error('Resend verification email failed', { email, error: result.error });
            return NextResponse.json({ error: 'Falha ao enviar e-mail. Tente novamente.' }, { status: 500 });
        }

        logger.info('Verification email resent', { email });
        return NextResponse.json({ sent: true, cooldown: COOLDOWN_SECONDS });
    } catch (error) {
        logger.error('Resend verification error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
