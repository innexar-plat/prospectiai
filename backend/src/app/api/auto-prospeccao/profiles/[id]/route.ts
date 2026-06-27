import { NextRequest, NextResponse } from 'next/server';
import { updateProfile, deleteProfile } from '@/modules/auto-prospeccao';
import { searchProfileSchema } from '@/modules/auto-prospeccao/domain/types';
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
  const parsed = searchProfileSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const profile = await updateProfile(id, authResult.ctx.workspaceId, parsed.data);
  return NextResponse.json({ data: profile });
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
  await deleteProfile(id, authResult.ctx.workspaceId);
  return new NextResponse(null, { status: 204 });
}
