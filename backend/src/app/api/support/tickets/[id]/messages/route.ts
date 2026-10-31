import { NextRequest, NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { rateLimit } from '@/lib/ratelimit';
import { formatZodError, supportMessageSchema } from '@/lib/validations/schemas';
import { SupportError, addUserMessage } from '@/lib/support-tickets';

function fail(error: unknown) {
    if (error instanceof SupportError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
}

/** POST /api/support/tickets/[id]/messages — customer reply (reopens the ticket). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getApiSession();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rl = await rateLimit(`support:msg:${session.user.id}`, 30, 60 * 60);
    if (!rl.success) return NextResponse.json({ error: 'Muitas mensagens em pouco tempo.' }, { status: 429 });

    const parsed = supportMessageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
    try {
        return NextResponse.json({ ticket: await addUserMessage(session.user.id, (await params).id, parsed.data.body) });
    } catch (error) {
        return fail(error);
    }
}
