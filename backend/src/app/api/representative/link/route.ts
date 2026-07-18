import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildRepLink } from '@/lib/representative';
import { getSiteUrlFromRequest } from '@/lib/site-url';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rep = await prisma.representative.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!rep) return NextResponse.json({ error: 'Representative not found' }, { status: 404 });

  const siteUrl = getSiteUrlFromRequest(req);
  const disclosureLink = buildRepLink(rep.id, siteUrl);

  return NextResponse.json({
    link: disclosureLink,
    code: rep.id,
  });
}
