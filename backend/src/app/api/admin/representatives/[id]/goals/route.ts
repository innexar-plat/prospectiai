import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const postSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2024).max(2099),
  targetCents: z.number().int().positive(),
  achievedCents: z.number().int().min(0).optional().default(0),
});

const patchSchema = z.object({
  id: z.string(),
  targetCents: z.number().int().positive().optional(),
  achievedCents: z.number().int().min(0).optional(),
});

const getQuerySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2099).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const parsed = getQuerySchema.safeParse({
    year: req.nextUrl.searchParams.get('year') ?? undefined,
  });

  const where: { representativeId: string; year?: number } = { representativeId: id };
  if (parsed.success && parsed.data.year) where.year = parsed.data.year;

  const goals = await prisma.repGoal.findMany({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  return NextResponse.json({
    items: goals.map((g) => ({
      id: g.id,
      targetAmount: g.targetCents,
      currentProgress: g.achievedCents,
      month: g.month,
      year: g.year,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const rep = await prisma.representative.findUnique({ where: { id } });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const goal = await prisma.repGoal.upsert({
    where: {
      representativeId_month_year: {
        representativeId: id,
        month: parsed.data.month,
        year: parsed.data.year,
      },
    },
    update: {
      targetCents: parsed.data.targetCents,
      achievedCents: parsed.data.achievedCents,
    },
    create: {
      representativeId: id,
      month: parsed.data.month,
      year: parsed.data.year,
      targetCents: parsed.data.targetCents,
      achievedCents: parsed.data.achievedCents,
    },
  });

  return NextResponse.json({
    id: goal.id,
    targetAmount: goal.targetCents,
    currentProgress: goal.achievedCents,
    month: goal.month,
    year: goal.year,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id: repId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.repGoal.findFirst({
    where: { id: parsed.data.id, representativeId: repId },
  });
  if (!existing) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.targetCents !== undefined) data.targetCents = parsed.data.targetCents;
  if (parsed.data.achievedCents !== undefined) data.achievedCents = parsed.data.achievedCents;

  const updated = await prisma.repGoal.update({
    where: { id: parsed.data.id },
    data,
  });

  return NextResponse.json({ id: updated.id, targetCents: updated.targetCents, achievedCents: updated.achievedCents });
}
