/**
 * Web Push helper: sends push notifications to a user's registered browser subscriptions.
 */
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

import { getSiteUrlForMarket } from '@/lib/site-url';
import type { Market } from '@/lib/market';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const DEFAULT_FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://precisionia.com.br';

let configured = false;

function ensureVapid() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(`mailto:suporte@precisionia.com.br`, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

/**
 * Send a web push notification to all of a user's subscriptions.
 * Silently removes expired/invalid subscriptions.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; link?: string | null },
  market: Market = 'BR',
) {
  if (!ensureVapid()) return;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  if (subs.length === 0) return;

  const frontendUrl = getSiteUrlForMarket(market);
  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.link ? `${frontendUrl}${payload.link}` : `${frontendUrl}/dashboard`,
  });

  const staleIds: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
          { TTL: 60 * 60 },
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }
}
