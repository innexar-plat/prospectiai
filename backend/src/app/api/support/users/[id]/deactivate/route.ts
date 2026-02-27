import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSupport } from '@/lib/admin';
import { logSupportAction } from '@/lib/audit';
import { supportDeactivateSchema, formatZodError } from '@/lib/validations/schemas';

export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isSupport(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await ctx.params;
    let body: { reason?: string } = {};
    try {
        const raw = await req.json().catch(() => ({}));
        const parsed = supportDeactivateSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }
        body = parsed.data;
    } catch {
        // empty body is ok
    }
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, disabledAt: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.disabledAt) {
        return NextResponse.json({ error: 'User account is already deactivated' }, { status: 400 });
    }
    await prisma.user.update({
        where: { id },
        data: { disabledAt: new Date() },
    });
    logSupportAction(session, 'support.users.deactivate', {
        resource: 'users',
        resourceId: id,
        details: body.reason ? { reason: body.reason } : undefined,
    }).catch(() => {});
    return NextResponse.json({ success: true });
}
