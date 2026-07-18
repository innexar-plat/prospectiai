import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { updateCommissionStatus } from '@/lib/representative';
import { z } from 'zod';

const patchSchema = z.object({
  status: z.enum(['APPROVED', 'PAID', 'CANCELLED']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ commissionId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { commissionId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await updateCommissionStatus(commissionId, parsed.data.status, session.user.id);
    return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
