import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { listTicketsForAdmin } from '@/lib/support-tickets';

const STATUSES = new Set(['OPEN', 'ANSWERED', 'CLOSED']);

/** GET /api/admin/support/tickets?status=OPEN|ANSWERED|CLOSED */
export async function GET(req: NextRequest) {
    const auth = await assertAdminSession();
    if (auth instanceof NextResponse) return auth;
    const status = req.nextUrl.searchParams.get('status');
    return NextResponse.json(await listTicketsForAdmin(status && STATUSES.has(status) ? (status as 'OPEN' | 'ANSWERED' | 'CLOSED') : undefined));
}
