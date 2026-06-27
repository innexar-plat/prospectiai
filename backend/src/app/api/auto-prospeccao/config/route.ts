import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConfig, updateConfig } from '@/modules/auto-prospeccao';
import { configSchema } from '@/modules/auto-prospeccao/domain/types';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET() {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const config = await getConfig(authResult.ctx.workspaceId);
  return NextResponse.json({ data: config });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const body = await req.json().catch(() => null);
  const parsed = configSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = await updateConfig(authResult.ctx.workspaceId, parsed.data);
  return NextResponse.json({ data: config });
}

// Suppress unused import lint warning (prisma is kept for potential future guards)
void prisma;
