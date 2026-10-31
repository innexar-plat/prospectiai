import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { formatZodError, supportMessageSchema } from '@/lib/validations/schemas';
import { SupportError, addAdminReply } from '@/lib/support-tickets';

function fail(error: unknown) {
    if (error instanceof SupportError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** POST /api/admin/support/tickets/[id]/messages — team reply ({ body, close? }); notifies the customer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await assertAdminSession();
    if (auth instanceof NextResponse) return auth;
    const parsed = supportMessageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    try {
        const ticket = await addAdminReply(auth.session.user!.id!, (await params).id, parsed.data.body, parsed.data.close === true);
        return NextResponse.json({ ticket });
    } catch (error) {
        return fail(error);
    }
}
