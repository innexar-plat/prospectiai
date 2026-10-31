import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { formatZodError, supportStatusSchema } from '@/lib/validations/schemas';
import { SupportError, getTicketForAdmin, setTicketStatusForAdmin } from '@/lib/support-tickets';

function fail(error: unknown) {
    if (error instanceof SupportError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** GET /api/admin/support/tickets/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await assertAdminSession();
    if (auth instanceof NextResponse) return auth;
    try {
        return NextResponse.json({ ticket: await getTicketForAdmin((await params).id) });
    } catch (error) {
        return fail(error);
    }
}

/** PATCH /api/admin/support/tickets/[id] — { status } */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await assertAdminSession();
    if (auth instanceof NextResponse) return auth;
    const parsed = supportStatusSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    try {
        return NextResponse.json({ ticket: await setTicketStatusForAdmin((await params).id, parsed.data.status) });
    } catch (error) {
        return fail(error);
    }
}
