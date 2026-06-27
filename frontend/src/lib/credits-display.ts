/** Shared credit counters for header badge, dashboard strip, and sidebar. */

export type CreditUsage = {
  leadsUsed?: number | null;
  leadsLimit?: number | null;
};

function toSafeInt(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function getRemainingCredits({ leadsUsed, leadsLimit }: CreditUsage): number {
  const used = toSafeInt(leadsUsed);
  const limit = toSafeInt(leadsLimit);
  return Math.max(0, limit - used);
}

export function formatCreditCount(value: number, locale = 'en-US'): string {
  return toSafeInt(value).toLocaleString(locale);
}

export function formatCreditUsage(
  { leadsUsed, leadsLimit }: CreditUsage,
  locale = 'en-US',
): { remaining: number; remainingLabel: string; usedLabel: string; limitLabel: string } {
  const used = toSafeInt(leadsUsed);
  const limit = toSafeInt(leadsLimit);
  const remaining = Math.max(0, limit - used);
  return {
    remaining,
    remainingLabel: formatCreditCount(remaining, locale),
    usedLabel: formatCreditCount(used, locale),
    limitLabel: formatCreditCount(limit, locale),
  };
}
