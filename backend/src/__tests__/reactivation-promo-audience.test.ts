import {
  hasActivePaidSubscription,
  isExpiredTrialWorkspace,
  isBrMarketWorkspace,
} from '@/lib/reactivation-promo-audience';

describe('reactivation-promo-audience', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const baseWorkspace = {
    plan: 'TRIAL',
    subscriptionStatus: 'trial_expired',
    currentPeriodEnd: past,
    subscriptionId: null,
    leadsLimit: 50,
    billingCycle: null,
    cnpj: null,
    reactivationPromoSentAt: null,
  };

  it('detects TRIAL with trial_expired status', () => {
    expect(isExpiredTrialWorkspace(baseWorkspace)).toBe(true);
  });

  it('detects TRIAL with past currentPeriodEnd', () => {
    expect(
      isExpiredTrialWorkspace({
        ...baseWorkspace,
        subscriptionStatus: 'trialing',
        currentPeriodEnd: past,
      }),
    ).toBe(true);
  });

  it('detects FREE after trial', () => {
    expect(
      isExpiredTrialWorkspace({
        ...baseWorkspace,
        plan: 'FREE',
        subscriptionStatus: 'trial_expired',
        leadsLimit: 0,
      }),
    ).toBe(true);
  });

  it('rejects active paid subscription', () => {
    expect(
      isExpiredTrialWorkspace({
        ...baseWorkspace,
        plan: 'BASIC',
        subscriptionStatus: 'active',
      }),
    ).toBe(false);
    expect(
      hasActivePaidSubscription({ plan: 'PRO', subscriptionStatus: 'active' }),
    ).toBe(true);
  });

  it('rejects active trialing trial', () => {
    expect(
      isExpiredTrialWorkspace({
        ...baseWorkspace,
        subscriptionStatus: 'trialing',
        currentPeriodEnd: future,
      }),
    ).toBe(false);
  });

  it('classifies TRIAL workspaces as BR', () => {
    expect(isBrMarketWorkspace(baseWorkspace)).toBe(true);
  });

  it('classifies Stripe subscription as US (not BR audience)', () => {
    expect(
      isBrMarketWorkspace({
        ...baseWorkspace,
        plan: 'BASIC',
        subscriptionId: 'sub_123',
        subscriptionStatus: 'active',
      }),
    ).toBe(false);
  });
});
