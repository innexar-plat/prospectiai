import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';

/** GET /api/admin/auto-prospeccao/workspaces — list workspaces with module status */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const [workspaces, total] = await Promise.all([
    prisma.workspace.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        plan: true,
        autoProspeccaoEnabled: true,
        createdAt: true,
        _count: {
          select: { prospectedLeads: true, autoProspeccaoRuns: true },
        },
      },
    }),
    prisma.workspace.count(),
  ]);

  return NextResponse.json({
    data: workspaces,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
