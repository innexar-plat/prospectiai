/**
 * Notification service: create in-app notifications and optionally send email by user preference.
 * When channel is provided, NotificationChannelConfig is respected (appEnabled / emailEnabled).
 */

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { notificationTemplate } from '@/lib/email-templates';
import type { NotificationType } from '@prisma/client';

/** Known notification channels (key + display name). Config stored in NotificationChannelConfig. */
export const NOTIFICATION_CHANNELS: ReadonlyArray<{ key: string; name: string }> = [
  { key: 'lead_analysis_ready', name: 'Análise de lead pronta' },
  { key: 'team_invite', name: 'Convite para workspace' },
  { key: 'admin_broadcast', name: 'Broadcast admin' },
];

export interface CreateNotificationInput {
  userId: string;
  workspaceId?: string | null;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
  /** If true, send email when user has notifyByEmail and channel allows email. */
  sendEmailIfPreferred?: boolean;
  /** Optional email subject when sending email. */
  emailSubject?: string;
  /** Channel key: if set, app/email are gated by NotificationChannelConfig. */
  channel?: string;
}

async function getChannelConfig(key: string): Promise<{ appEnabled: boolean; emailEnabled: boolean }> {
  const row = await prisma.notificationChannelConfig.findUnique({
    where: { key },
    select: { appEnabled: true, emailEnabled: true },
  });
  return row
    ? { appEnabled: row.appEnabled, emailEnabled: row.emailEnabled }
    : { appEnabled: true, emailEnabled: true };
}

/** For admin API: list all known channels with their DB config (defaults true if no row). */
export async function getChannelsWithConfig(): Promise<
  Array<{ key: string; name: string; appEnabled: boolean; emailEnabled: boolean }>
> {
  const rows = await prisma.notificationChannelConfig.findMany({
    select: { key: true, appEnabled: true, emailEnabled: true },
  });
  const map = new Map(rows.map((r) => [r.key, { appEnabled: r.appEnabled, emailEnabled: r.emailEnabled }]));
  return NOTIFICATION_CHANNELS.map((ch) => {
    const config = map.get(ch.key) ?? { appEnabled: true, emailEnabled: true };
    return { key: ch.key, name: ch.name, appEnabled: config.appEnabled, emailEnabled: config.emailEnabled };
  });
}

/**
 * Create a notification for a user. Optionally send email when user has notifyByEmail.
 * If channel is set, respects NotificationChannelConfig (appEnabled / emailEnabled).
 */
export async function createNotification(input: CreateNotificationInput): Promise<{ id: string }> {
  const {
    userId,
    workspaceId,
    title,
    message,
    type = 'INFO',
    link,
    sendEmailIfPreferred = false,
    emailSubject,
    channel,
  } = input;

  let appEnabled = true;
  let emailEnabled = true;
  if (channel) {
    const config = await getChannelConfig(channel);
    appEnabled = config.appEnabled;
    emailEnabled = config.emailEnabled;
  }

  let notificationId = '';
  if (appEnabled) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        workspaceId: workspaceId ?? undefined,
        title,
        message,
        type,
        link: link ?? undefined,
      },
      select: { id: true },
    });
    notificationId = notification.id;
  }

  const shouldSendEmail = sendEmailIfPreferred && emailEnabled;
  if (shouldSendEmail) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, notifyByEmail: true },
    });
    if (user?.email && user.notifyByEmail) {
      const subject = emailSubject ?? title;
      const html = notificationTemplate(title, message, link);
      void sendEmail(user.email, subject, html);
    }
  }

  return { id: notificationId };
}

/**
 * Create a notification for every user (e.g. admin broadcast).
 * If channel is provided (e.g. admin_broadcast), respects NotificationChannelConfig.
 * When emailEnabled, sends email to each user with notifyByEmail.
 */
export async function createNotificationForAllUsers(input: {
  title: string;
  message: string;
  type?: NotificationType;
  link?: string | null;
  channel?: string;
  emailSubject?: string;
}): Promise<{ count: number }> {
  const users = await prisma.user.findMany({
    where: { email: { not: null }, disabledAt: null },
    select: { id: true, email: true, notifyByEmail: true },
  });

  let appEnabled = true;
  let emailEnabled = false;
  if (input.channel) {
    const config = await getChannelConfig(input.channel);
    appEnabled = config.appEnabled;
    emailEnabled = config.emailEnabled;
  }

  if (appEnabled) {
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title: input.title,
        message: input.message,
        type: input.type ?? 'SYSTEM',
        link: input.link ?? undefined,
      })),
    });
  }

  if (emailEnabled) {
    const subject = input.emailSubject ?? input.title;
    const html = notificationTemplate(input.title, input.message, input.link ?? undefined);
    for (const u of users) {
      if (u.email && u.notifyByEmail) {
        void sendEmail(u.email, subject, html);
      }
    }
  }

  return { count: users.length };
}
