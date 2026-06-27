import { NextResponse } from 'next/server';
import { getApiSession } from '@/lib/api-auth';
import { setPresence } from '@/lib/redis';

export async function POST() {
    const session = await getApiSession();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await setPresence(session.user.id);
    return NextResponse.json({ ok: true });
}
