import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';
import { logger } from '@/lib/logger';
import { setPrimaryContact } from '@/lib/contact-intelligence';

async function resolveLeadId(id: string): Promise<string | null> {
  const byId = await prisma.lead.findUnique({ where: { id }, select: { id: true } });
  if (byId?.id) return byId.id;

  const byPlaceId = await prisma.lead.findUnique({ where: { placeId: id }, select: { id: true } });
  return byPlaceId?.id ?? null;
}

/**
 * PATCH /api/leads/[id]/contact-intelligence/primary
 * Body: { contactId: string, reason?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getOrCreateRequestId(req);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: 'Unauthorized' }, { status: 401, requestId });
    }

    const { id } = await params;
    if (!id || !id.trim()) {
      return jsonWithRequestId({ error: 'Missing id parameter' }, { status: 400, requestId });
    }

    const body = await req.json().catch(() => null) as { contactId?: string; reason?: string } | null;
    if (!body?.contactId || !body.contactId.trim()) {
      return jsonWithRequestId({ error: 'contactId is required' }, { status: 400, requestId });
    }

    const leadId = await resolveLeadId(id);
    if (!leadId) {
      return jsonWithRequestId({ error: 'Lead not found' }, { status: 404, requestId });
    }

    const data = await setPrimaryContact(leadId, body.contactId.trim(), {
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? null,
      reason: body.reason?.trim() || null,
    });
    if (!data) {
      return jsonWithRequestId({ error: 'Contact not found' }, { status: 404, requestId });
    }

    return jsonWithRequestId({ data }, { requestId });
  } catch (error) {
    logger.error('Contact intelligence primary PATCH error', {
      error: error instanceof Error ? error.message : 'Unknown',
    }, requestId);
    return jsonWithRequestId({ error: 'Internal server error' }, { status: 500, requestId });
  }
}
