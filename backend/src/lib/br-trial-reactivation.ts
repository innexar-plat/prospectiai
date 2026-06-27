/**
 * BR expired-trial reactivation promo — find eligible users and send emails.
 * Coordinates with STARTER_PROMO_BR (planId STARTER_PROMO_BR, promo=reactivation).
 */

import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { STARTER_PROMO_BR, createPromoToken } from '@/lib/billing-promo';
import { getSiteUrlForMarket } from '@/lib/site-url';
import { getReactivationPromoCheckoutUrl } from '@/lib/i18n/messages';
import {
  buildReactivationPromoEmailHtml,
  getReactivationPromoEmailSubject,
} from '@/lib/reactivation-promo-email';
import {
  findReactivationPromoRecipients,
  type ReactivationPromoRecipient,
} from '@/lib/reactivation-promo-audience';

export const BR_TRIAL_REACTIVATION_PROMO_CODE = 'reactivation';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1200;

export type BrTrialReactivationResult = {
  eligible: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  recipients: ReactivationPromoRecipient[];
};

function buildCheckoutUrlForRecipient(userId: string): string {
  const base = getSiteUrlForMarket('BR').replace(/\/$/, '');
  try {
    const token = createPromoToken(userId, STARTER_PROMO_BR.id);
    return `${base}/checkout?promo=reactivation&token=${encodeURIComponent(token)}`;
  } catch {
    return getReactivationPromoCheckoutUrl(base);
  }
}

export async function countEligibleBrTrialReactivationRecipients(): Promise<number> {
  const recipients = await findReactivationPromoRecipients();
  return recipients.length;
}

export async function runBrTrialReactivationCampaign(options: {
  dryRun: boolean;
  limit?: number;
}): Promise<BrTrialReactivationResult> {
  const subject = getReactivationPromoEmailSubject();
  const recipients = await findReactivationPromoRecipients(options.limit);

  if (options.dryRun || recipients.length === 0) {
    return {
      eligible: recipients.length,
      sent: 0,
      failed: 0,
      dryRun: true,
      recipients,
    };
  }

  let sent = 0;
  let failed = 0;
  const siteUrl = getSiteUrlForMarket('BR');

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    for (const recipient of batch) {
      const firstName = recipient.name?.split(/\s/)[0];
      const checkoutUrl = buildCheckoutUrlForRecipient(recipient.userId);
      const html = buildReactivationPromoEmailHtml({
        userName: firstName,
        checkoutUrl,
        siteUrl,
      });
      const result = await sendEmail(recipient.email, subject, html);

      const now = new Date();

      await prisma.$transaction([
        prisma.emailSendLog.create({
          data: {
            type: 'CAMPAIGN',
            userId: recipient.userId,
            email: recipient.email,
            subject,
            status: result.sent ? 'SENT' : 'FAILED',
            error: result.error ?? null,
          },
        }),
        ...(result.sent
          ? [
              prisma.workspace.update({
                where: { id: recipient.workspaceId },
                data: {
                  reactivationPromoSentAt: now,
                  starterPromoEligible: true,
                  starterPromoCode: BR_TRIAL_REACTIVATION_PROMO_CODE,
                },
              }),
            ]
          : []),
      ]);

      if (result.sent) {
        sent += 1;
      } else {
        failed += 1;
      }
    }

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return {
    eligible: recipients.length,
    sent,
    failed,
    dryRun: false,
    recipients,
  };
}
