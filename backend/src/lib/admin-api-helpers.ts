import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { logAdminAction, type AuditAction } from '@/lib/audit';
import { adminListQuerySchema, formatZodError } from '@/lib/validations/schemas';
import { prisma } from '@/lib/prisma';

export interface AdminListOptions<T, Q = any> {
    req: NextRequest;
    resourceName: string;
    auditAction: AuditAction;
    fetchItems: (limit: number, offset: number, query: Q) => Promise<T[]>;
    countItems: (query: Q) => Promise<number>;
    transform?: (items: T[]) => Promise<any[]> | any[];
    parseQuery?: (req: NextRequest) => Q;
}

export async function handleAdminListRequest<T, Q = any>(options: AdminListOptions<T, Q>) {
    const { req, resourceName, auditAction, fetchItems, countItems, transform, parseQuery } = options;

    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const parsed = adminListQuerySchema.safeParse({
            limit: req.nextUrl.searchParams.get('limit') ?? undefined,
            offset: req.nextUrl.searchParams.get('offset') ?? undefined,
        });

        if (!parsed.success) {
            return NextResponse.json({ error: formatZodError(parsed) }, { status: 400 });
        }

        const { limit = 20, offset = 0 } = parsed.data;
        const safeLimit = Math.min(limit, 100);
        const safeOffset = Math.max(0, offset);
        const query = parseQuery ? parseQuery(req) : ({} as Q);

        const [rawItems, total] = await Promise.all([
            fetchItems(safeLimit, safeOffset, query),
            countItems(query),
        ]);

        const items = transform ? await transform(rawItems) : rawItems;

        logAdminAction(session, auditAction, {
            resource: resourceName,
            details: { limit: safeLimit, offset: safeOffset, total, ...query }
        }).catch(() => { });

        return NextResponse.json({ items, total, limit: safeLimit, offset: safeOffset });
    } catch (e) {
        const { logger } = await import('@/lib/logger');
        logger.error(`Admin ${resourceName} list error`, { error: e instanceof Error ? e.message : 'Unknown' });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
