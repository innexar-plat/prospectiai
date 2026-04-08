/**
 * GET /api/integrations/agendor
 * Tests whether Agendor integration is configured and token is valid.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { encryptEmailSecret } from '@/lib/email-config-encrypt';
import { prisma } from '@/lib/prisma';
import { getAgendorApiTokenForUser } from '@/lib/agendor-config';

const saveTokenSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token, source } = await getAgendorApiTokenForUser(session.user.id);
    if (!token) {
      return NextResponse.json({ ok: false, connected: false, source: null });
    }

    const probe = await fetch('https://api.agendor.com.br/v3/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Token ${token}`,
        Accept: 'application/json',
      },
    });

    if (!probe.ok) {
      return NextResponse.json({ ok: false, connected: false, source }, { status: probe.status === 401 ? 401 : 502 });
    }

    const body = (await probe.json().catch(() => ({}))) as { data?: { id?: number; name?: string } };
    return NextResponse.json({
      ok: true,
      connected: true,
      source,
      user: body?.data ? { id: body.data.id, name: body.data.name } : undefined,
    });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Agendor integration test error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = saveTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { agendorApiTokenEncrypted: encryptEmailSecret(parsed.data.token.trim()) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Agendor token save error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { agendorApiTokenEncrypted: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Agendor token delete error', { error: error instanceof Error ? error.message : 'Unknown' });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
