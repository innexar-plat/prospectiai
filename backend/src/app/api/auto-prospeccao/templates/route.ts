import { NextRequest, NextResponse } from 'next/server';
import { listTemplates, createTemplate } from '@/modules/auto-prospeccao';
import { templateSchema } from '@/modules/auto-prospeccao/domain/types';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET() {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const templates = await listTemplates(authResult.ctx.workspaceId);
  return NextResponse.json({ data: templates });
}

export async function POST(req: NextRequest) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const body = await req.json().catch(() => null);
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const template = await createTemplate(authResult.ctx.workspaceId, authResult.ctx.userId, parsed.data);
  return NextResponse.json({ data: template }, { status: 201 });
}
