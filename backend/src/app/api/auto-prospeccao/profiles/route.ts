import { NextRequest, NextResponse } from 'next/server';
import { listProfiles, createProfile } from '@/modules/auto-prospeccao';
import { searchProfileSchema } from '@/modules/auto-prospeccao/domain/types';
import { requireWorkspace, requireModuleEnabled } from '../_helpers';

export async function GET() {
  const authResult = await requireWorkspace();
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const profiles = await listProfiles(authResult.ctx.workspaceId);
  return NextResponse.json({ data: profiles });
}

export async function POST(req: NextRequest) {
  const authResult = await requireWorkspace(true);
  if (!authResult.ok) return authResult.error;

  const err = await requireModuleEnabled(authResult.ctx.workspaceId);
  if (err) return err;

  const body = await req.json().catch(() => null);
  const parsed = searchProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const profile = await createProfile(authResult.ctx.workspaceId, parsed.data);
  return NextResponse.json({ data: profile }, { status: 201 });
}
