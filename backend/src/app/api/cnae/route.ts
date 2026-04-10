import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * GET /api/cnae?q=consultoria&limit=20
 * Autocomplete de códigos CNAE. Busca por código ou descrição.
 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20', 10) || 20, 50);

    if (q.length < 2) {
      return jsonWithRequestId({ codes: [] }, { requestId });
    }

    // Search by code prefix or description (case-insensitive)
    const isCodeSearch = /^\d+$/.test(q);

    const codes = await prisma.cnaeCode.findMany({
      where: isCodeSearch
        ? { code: { startsWith: q } }
        : { description: { contains: q, mode: 'insensitive' } },
      take: limit,
      orderBy: isCodeSearch ? { code: 'asc' } : { description: 'asc' },
    });

    return jsonWithRequestId({ codes }, { requestId });
  } catch (err) {
    return jsonWithRequestId(
      { error: 'Internal server error' },
      { status: 500, requestId }
    );
  }
}
