import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { SupportError, closeUserTicket, getUserTicket } from '@/lib/support-tickets';

function fail(error: unknown) {
    if (error instanceof SupportError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** GET /api/support/tickets/[id] — ticket with its conversation. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        return NextResponse.json({ ticket: await getUserTicket(session.user.id, (await params).id) });
    } catch (error) {
        return fail(error);
    }
}

/** PATCH /api/support/tickets/[id] — the customer closes the ticket. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        return NextResponse.json({ ticket: await closeUserTicket(session.user.id, (await params).id) });
    } catch (error) {
        return fail(error);
    }
}
