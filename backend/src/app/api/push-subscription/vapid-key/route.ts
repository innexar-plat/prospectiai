import { NextResponse } from 'next/server';

/** GET /api/push-subscription/vapid-key — return the VAPID public key */
export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
