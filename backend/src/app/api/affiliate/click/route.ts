import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAffiliateByCode } from '@/lib/affiliate';

const APP_BASE = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const USER_AGENT_MAX_LEN = 500;

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('ref')?.trim();
  if (!code) {
    const base = APP_BASE.replace(/\/$/, '');
    return NextResponse.redirect(`${base}/auth/signup`, 302);
  }
  const affiliate = await getAffiliateByCode(code);
  if (affiliate) {
    const ua = req.headers.get('user-agent') ?? null;
    const userAgent = ua && ua.length > USER_AGENT_MAX_LEN ? ua.slice(0, USER_AGENT_MAX_LEN) : ua;
    await prisma.affiliateClick.create({
      data: { affiliateId: affiliate.id, userAgent },
    });
  }
  const base = APP_BASE.replace(/\/$/, '');
  const signupParams = new URLSearchParams();
  signupParams.set('ref', code);
  const utmSource = req.nextUrl.searchParams.get('utm_source');
  const utmMedium = req.nextUrl.searchParams.get('utm_medium');
  const utmCampaign = req.nextUrl.searchParams.get('utm_campaign');
  if (utmSource) signupParams.set('utm_source', utmSource);
  if (utmMedium) signupParams.set('utm_medium', utmMedium);
  if (utmCampaign) signupParams.set('utm_campaign', utmCampaign);
  const signupUrl = `${base}/auth/signup?${signupParams.toString()}`;
  return NextResponse.redirect(signupUrl, 302);
}
