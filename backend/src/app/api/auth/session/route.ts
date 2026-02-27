import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = session.user as { role?: 'admin' | 'support' | null } | undefined;
    return NextResponse.json({
        user: {
            id: session.user?.id,
            name: session.user?.name,
            email: session.user?.email,
            image: session.user?.image,
            plan: session.user?.plan ?? 'FREE',
            leadsUsed: session.user?.leadsUsed ?? 0,
            leadsLimit: session.user?.leadsLimit ?? 10,
            role: user?.role ?? null,
        }
    });
}
