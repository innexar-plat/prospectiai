import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * GET /api/auth/verify-email?token=...
 * Verifies email using token from sign-up; sets user.emailVerified and deletes token.
 */
export async function GET(req: NextRequest) {
    try {
        const token = req.nextUrl.searchParams.get('token');
        if (!token || token.trim() === '') {
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 400 });
        }

        const record = await prisma.verificationToken.findUnique({
            where: { token },
        });
        if (!record || record.expires < new Date()) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
        }

        const email = record.identifier;
        await prisma.$transaction([
            prisma.user.updateMany({
                where: { email },
                data: { emailVerified: new Date() },
            }),
            prisma.verificationToken.deleteMany({
                where: { identifier: email, token },
            }),
        ]);

        return NextResponse.json({ message: 'Email verified successfully' });
    } catch (error) {
        logger.error('Verify email error', { error: error instanceof Error ? error.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
