import { NextRequest, NextResponse } from 'next/server';
import { updateTemplate, deleteTemplate, cloneSystemTemplate } from '@/modules/auto-prospeccao';
import { templateSchema } from '@/modules/auto-prospeccao/domain/types';
import { requireWorkspace, requireModuleEnabled } from '../../_helpers';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Allow cloning system template via ?action=clone
  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'clone') {
    const template = await cloneSystemTemplate(id, authResult.ctx.workspaceId, authResult.ctx.userId);
    return NextResponse.json({ data: template }, { status: 201 });
  }

  const parsed = templateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const template = await updateTemplate(id, authResult.ctx.workspaceId, parsed.data);
  return NextResponse.json({ data: template });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const { id } = await params;
  await deleteTemplate(id, authResult.ctx.workspaceId);
  return new NextResponse(null, { status: 204 });
}
