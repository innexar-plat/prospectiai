import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/audit';
import { sendPasswordResetEmail } from '@/lib/email';
import { adminResetPasswordSchema, formatZodError } from '@/lib/validations/schemas';

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = adminResetPasswordSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    }
    const { sendEmail, temporaryPassword } = parsed.data;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!user.email) return NextResponse.json({ error: 'User has no email' }, { status: 400 });

    const updateData: {
        password?: string;
        resetToken: string | null;
        resetTokenExpires: Date | null;
    } = {
        resetToken: null,
        resetTokenExpires: null,
    };

    if (temporaryPassword != null && temporaryPassword.length >= 8) {
        updateData.password = await bcrypt.hash(temporaryPassword, 10);
    }

    let token: string | undefined;
    if (sendEmail === true) {
        token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000);
        updateData.resetToken = token;
        updateData.resetTokenExpires = expires;
    }

    await prisma.user.update({
        where: { id },
        data: updateData,
    });

    if (sendEmail === true && token) {
        const { sent } = await sendPasswordResetEmail(user.email, token);
        const { logger } = await import('@/lib/logger');
        if (!sent && process.env.NODE_ENV === 'development') {
            logger.info('Admin reset-password: email not sent', { userId: id });
        }
    }

    void logAdminAction(session, 'admin.users.reset-password', {
        resource: 'users',
        resourceId: id,
        details: { sendEmail: !!sendEmail, temporaryPassword: !!(temporaryPassword && temporaryPassword.length >= 8) },
    });

    const messages: string[] = [];
    if (sendEmail === true) messages.push('Password reset email sent.');
    if (temporaryPassword != null && temporaryPassword.length >= 8) messages.push('Temporary password set.');
    return NextResponse.json({
        message: messages.join(' ') || 'Done.',
        devToken: sendEmail === true && token && process.env.NODE_ENV === 'development' ? token : undefined,
    });
}
