import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/admin-api-helpers';
import { prisma } from '@/lib/prisma';

/** GET /api/admin/auto-prospeccao/config?workspaceId=... */
export async function GET(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  const config = await prisma.autoProspeccaoConfig.findUnique({ where: { workspaceId } });
  if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: config });
}

/** PATCH /api/admin/auto-prospeccao/config?workspaceId=... */
export async function PATCH(req: NextRequest) {
  const authResult = await assertAdminSession();
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowedFields = [
    'isActive',
    'searchIntervalHours',
    'analyzeDelayMinutes',
    'maxLeadsPerRun',
    'maxEmailsPerDay',
    'maxCrmPushPerDay',
    'hotScoreMin',
    'warmScoreMin',
    'crmAutoSend',
    'crmProvider',
    'crmOwnerUserId',
    'emailAutoSend',
    'emailStepIntervalHours',
    'scheduleTimeStart',
    'scheduleTimeEnd',
    'scheduleDays',
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const updated = await prisma.autoProspeccaoConfig.update({
    where: { workspaceId },
    data,
  });

  return NextResponse.json({ data: updated });
}
