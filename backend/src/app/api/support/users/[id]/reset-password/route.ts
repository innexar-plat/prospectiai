import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSupport } from '@/lib/admin';
import { logSupportAction } from '@/lib/audit';
import { sendPasswordResetEmail } from '@/lib/email';
import { adminResetPasswordSchema, formatZodError } from '@/lib/validations/schemas';

async function buildResetUpdateData(
    temporaryPassword: string | null | undefined,
    sendEmail: boolean,
): Promise<{ updateData: { password?: string; resetToken: string | null; resetTokenExpires: Date | null }; token?: string }> {
    const updateData: { password?: string; resetToken: string | null; resetTokenExpires: Date | null } = {
        resetToken: null,
        resetTokenExpires: null,
    };
    if (temporaryPassword != null && temporaryPassword.length >= 8) {
        updateData.password = await bcrypt.hash(temporaryPassword, 10);
    }
    let token: string | undefined;
    if (sendEmail === true) {
        token = crypto.randomBytes(32).toString('hex');
        updateData.resetToken = token;
        updateData.resetTokenExpires = new Date(Date.now() + 3600000);
    }
    return { updateData, token };
}

type PerformResetResult = { ok: true; message: string; devToken?: string } | { ok: false; error: NextResponse };

function buildResetSuccessMessage(sendEmail: boolean, temporaryPassword: string | null | undefined): string {
    const messages: string[] = [];
    if (sendEmail) messages.push('Password reset email sent.');
    if (temporaryPassword != null && temporaryPassword.length >= 8) messages.push('Temporary password set.');
    return messages.join(' ') || 'Done.';
}

async function performResetPassword(
    id: string,
    data: { sendEmail?: boolean; temporaryPassword?: string | null },
): Promise<PerformResetResult> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
    if (!user.email) return { ok: false, error: NextResponse.json({ error: 'User has no email' }, { status: 400 }) };
    const sendEmail = data.sendEmail === true;
    const { updateData, token } = await buildResetUpdateData(data.temporaryPassword, sendEmail);
    await prisma.user.update({ where: { id }, data: updateData });
    if (sendEmail && token) {
        const { sent } = await sendPasswordResetEmail(user.email, token);
        const { logger } = await import('@/lib/logger');
        if (!sent && process.env.NODE_ENV === 'development') logger.info('Support reset-password: email not sent', { userId: id });
    }
    const devToken = sendEmail && token && process.env.NODE_ENV === 'development' ? token : undefined;
    return { ok: true, message: buildResetSuccessMessage(sendEmail, data.temporaryPassword), devToken };
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSupport(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = adminResetPasswordSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    const result = await performResetPassword(id, parsed.data);
    if (!result.ok) return result.error;
    logSupportAction(session, 'support.users.reset-password', {
        resource: 'users',
        resourceId: id,
        details: { sendEmail: !!parsed.data.sendEmail, temporaryPassword: !!(parsed.data.temporaryPassword && parsed.data.temporaryPassword.length >= 8) },
    }).catch(() => {});
    return NextResponse.json({ message: result.message, devToken: result.devToken });
}
