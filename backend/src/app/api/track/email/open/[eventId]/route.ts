import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 1x1 transparent GIF (base64)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/**
 * GET /api/track/email/open/[eventId]
 * Tracking pixel for email open detection.
 * Called automatically when recipient opens the email.
 * Returns a 1x1 transparent GIF and records the open time.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  // Update openedAt only on first open (idempotent)
  try {
    await prisma.prospectedLeadEmailEvent.updateMany({
      where: { id: eventId, openedAt: null },
      data: { openedAt: new Date() },
    });
  } catch {
    // Ignore errors — never fail the pixel response
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
