import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { rateLimit } from '@/lib/ratelimit';
import { formatZodError, supportTicketCreateSchema } from '@/lib/validations/schemas';
import { SupportError, createTicket, listUserTickets } from '@/lib/support-tickets';

function fail(error: unknown) {
    if (error instanceof SupportError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** GET /api/support/tickets — the signed-in user's tickets. */
export async function GET() {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        return NextResponse.json({ tickets: await listUserTickets(session.user.id) });
    } catch (error) {
        return fail(error);
    }
}

/** POST /api/support/tickets — open a ticket with its first message. */
export async function POST(req: NextRequest) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rl = await rateLimit(`support:create:${session.user.id}`, 5, 60 * 60);
    if (!rl.success) return NextResponse.json({ error: 'Muitos chamados em pouco tempo. Tente novamente mais tarde.' }, { status: 429 });

    const parsed = supportTicketCreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    try {
        const ticket = await createTicket(session.user.id, parsed.data);
        return NextResponse.json({ ticket }, { status: 201 });
    } catch (error) {
        return fail(error);
    }
}
