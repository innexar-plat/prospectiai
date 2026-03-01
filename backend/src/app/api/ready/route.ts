import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getOrCreateRequestId, jsonWithRequestId } from '@/lib/request-id';

/**
 * Readiness endpoint: checks DB connectivity.
 * Use in orchestrators (Kubernetes readinessProbe) so traffic is only sent when DB is up.
 * Returns 200 when DB responds, 503 otherwise. Health (/api/health) stays lightweight for liveness.
 */
export async function GET(req: NextRequest) {
  const requestId = getOrCreateRequestId(req);
  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    return jsonWithRequestId({ status: 'ready' }, { requestId });
  } catch {
    return jsonWithRequestId({ status: 'not ready', error: 'Database unavailable' }, { requestId, status: 503 });
  }
}
