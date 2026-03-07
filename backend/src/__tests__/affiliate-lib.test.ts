/**
 * Unit tests for affiliate lib (with Prisma mocks).
 */
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdateMany = jest.fn();
const mockCount = jest.fn();
const mockReferralFindFirst = jest.fn();
const mockReferralCreate = jest.fn();
const mockReferralUpdate = jest.fn();
const mockCommissionCreate = jest.fn();
const mockCommissionFindFirst = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    affiliate: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      findMany: jest.fn(),
      create: jest.fn(),
    },
    affiliateSettings: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    referral: {
      findFirst: mockReferralFindFirst,
      create: mockReferralCreate,
      update: mockReferralUpdate,
    },
    affiliateCommission: {
      create: mockCommissionCreate,
      updateMany: mockUpdateMany,
      findFirst: mockCommissionFindFirst,
      findMany: jest.fn(),
      count: mockCount,
    },
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : (arg as (tx: unknown) => Promise<unknown>)({})
    ),
  },
}));

jest.mock('@/lib/email', () => ({
  sendAffiliateConversionEmail: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('@/lib/prisma').prisma;

describe('affiliate lib', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAffiliateByCode', () => {
    const { getAffiliateByCode } = require('@/lib/affiliate');

    it('returns null for empty code', async () => {
      expect(await getAffiliateByCode('')).toBeNull();
      expect(await getAffiliateByCode('   ')).toBeNull();
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('returns null for non-string', async () => {
      expect(await getAffiliateByCode(null as unknown as string)).toBeNull();
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('calls findFirst with trimmed uppercase code and APPROVED status', async () => {
      mockFindFirst.mockResolvedValue({ id: 'a1', code: 'ABC123' });
      const result = await getAffiliateByCode('  abc123  ');
      expect(result).toEqual({ id: 'a1', code: 'ABC123' });
      expect(mockFindFirst).toHaveBeenCalledWith({
        where: { code: 'ABC123', status: 'APPROVED' },
      });
    });

    it('returns null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      expect(await getAffiliateByCode('XYZ')).toBeNull();
    });
  });

  describe('getOrCreateSettings', () => {
    const { getOrCreateSettings } = require('@/lib/affiliate');
    const findUnique = prisma.affiliateSettings.findUnique;
    const findFirst = prisma.affiliateSettings.findFirst;
    const create = prisma.affiliateSettings.create;

    it('returns existing settings when findUnique returns row', async () => {
      findUnique.mockResolvedValue({
        defaultCommissionRatePercent: 25,
        cookieDurationDays: 14,
        commissionRule: 'RECURRING',
        approvalHoldDays: 7,
        minPayoutCents: 5000,
        allowSelfSignup: false,
      });
      const result = await getOrCreateSettings();
      expect(result.defaultCommissionRatePercent).toBe(25);
      expect(result.commissionRule).toBe('RECURRING');
      expect(create).not.toHaveBeenCalled();
    });

    it('creates default settings when findUnique returns null', async () => {
      findUnique.mockResolvedValue(null);
      create.mockResolvedValue({
        defaultCommissionRatePercent: 20,
        cookieDurationDays: 30,
        commissionRule: 'FIRST_PAYMENT_ONLY',
        approvalHoldDays: 15,
        minPayoutCents: 10000,
        allowSelfSignup: true,
      });
      const result = await getOrCreateSettings();
      expect(result.defaultCommissionRatePercent).toBe(20);
      expect(create).toHaveBeenCalled();
    });
  });

  describe('isSelfReferral', () => {
    const { isSelfReferral } = require('@/lib/affiliate');

    it('returns false when userEmail is null', async () => {
      expect(await isSelfReferral('aff1', null)).toBe(false);
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns true when affiliate not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await isSelfReferral('aff1', 'u@x.com')).toBe(true);
    });

    it('returns true when emails match (case insensitive)', async () => {
      mockFindUnique.mockResolvedValue({ email: 'u@x.com', userId: 'u1', user: null });
      expect(await isSelfReferral('aff1', 'U@X.COM')).toBe(true);
    });

    it('returns false when emails differ', async () => {
      mockFindUnique.mockResolvedValue({ email: 'aff@x.com', userId: 'u1', user: null });
      expect(await isSelfReferral('aff1', 'user@x.com')).toBe(false);
    });

    it('uses user.email when affiliate email is null', async () => {
      mockFindUnique.mockResolvedValue({ email: null, userId: 'u1', user: { email: 'same@x.com' } });
      expect(await isSelfReferral('aff1', 'same@x.com')).toBe(true);
    });
  });

  describe('generateAffiliateCode', () => {
    const { generateAffiliateCode } = require('@/lib/affiliate');

    it('returns 8-char code when not taken', async () => {
      mockFindUnique.mockResolvedValue(null);
      const code = await generateAffiliateCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { code: expect.any(String) } });
    });

    it('retries when code exists', async () => {
      mockFindUnique.mockResolvedValueOnce({ id: 'x' }).mockResolvedValueOnce(null);
      const code = await generateAffiliateCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(mockFindUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('approveCommissionsByAvailableAt', () => {
    const { approveCommissionsByAvailableAt } = require('@/lib/affiliate');

    it('calls updateMany with PENDING and availableAt lte now', async () => {
      mockUpdateMany.mockResolvedValue({ count: 3 });
      const count = await approveCommissionsByAvailableAt();
      expect(count).toBe(3);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', availableAt: { lte: expect.any(Date) } },
        data: { status: 'APPROVED' },
      });
    });
  });

  describe('cancelCommissionsByOrderOrSubscription', () => {
    const { cancelCommissionsByOrderOrSubscription } = require('@/lib/affiliate');

    it('returns 0 when both orderId and subscriptionId are empty', async () => {
      expect(await cancelCommissionsByOrderOrSubscription(null, null)).toBe(0);
      expect(await cancelCommissionsByOrderOrSubscription(undefined, undefined)).toBe(0);
      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('calls updateMany with orderId in OR', async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });
      const count = await cancelCommissionsByOrderOrSubscription('ord-1', null);
      expect(count).toBe(1);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING', 'APPROVED'] }, OR: [{ orderId: 'ord-1' }] },
        data: { status: 'CANCELLED' },
      });
    });

    it('calls updateMany with subscriptionId in OR', async () => {
      mockUpdateMany.mockResolvedValue({ count: 2 });
      const count = await cancelCommissionsByOrderOrSubscription(null, 'sub-1');
      expect(count).toBe(2);
      expect(mockUpdateMany).toHaveBeenCalledWith({
        where: { status: { in: ['PENDING', 'APPROVED'] }, OR: [{ subscriptionId: 'sub-1' }] },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('createCommissionForFirstPayment', () => {
    const { createCommissionForFirstPayment } = require('@/lib/affiliate');
    const findUniqueSettings = prisma.affiliateSettings.findUnique as jest.Mock;
    const createSettings = prisma.affiliateSettings.create as jest.Mock;

    beforeEach(() => {
      findUniqueSettings.mockResolvedValue({
        defaultCommissionRatePercent: 20,
        approvalHoldDays: 15,
      });
    });

    it('returns null when referral already converted', async () => {
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        convertedAt: new Date(),
        affiliateId: 'aff1',
        affiliate: { status: 'APPROVED', commissionRatePercent: 10 },
      });
      const result = await createCommissionForFirstPayment({
        userId: 'u1',
        workspaceId: 'w1',
        userEmail: 'u@x.com',
        planId: 'p1',
        valueCents: 10000,
      });
      expect(result).toBeNull();
    });

    it('returns null when affiliate not APPROVED', async () => {
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        convertedAt: null,
        affiliateId: 'aff1',
        affiliate: { status: 'PENDING', commissionRatePercent: 10 },
      });
      const result = await createCommissionForFirstPayment({
        userId: 'u1',
        workspaceId: 'w1',
        userEmail: 'u@x.com',
        planId: 'p1',
        valueCents: 10000,
      });
      expect(result).toBeNull();
    });

    it('returns null when self-referral', async () => {
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        convertedAt: null,
        affiliateId: 'aff1',
        affiliate: { status: 'APPROVED', commissionRatePercent: 10 },
      });
      mockFindUnique.mockResolvedValue({ email: 'u@x.com', user: null });
      const result = await createCommissionForFirstPayment({
        userId: 'u1',
        workspaceId: 'w1',
        userEmail: 'u@x.com',
        planId: 'p1',
        valueCents: 10000,
      });
      expect(result).toBeNull();
    });

    it('returns null when no referral and no metadata code', async () => {
      mockReferralFindFirst.mockResolvedValue(null);
      const result = await createCommissionForFirstPayment({
        userId: 'u1',
        workspaceId: 'w1',
        userEmail: 'u@x.com',
        planId: 'p1',
        valueCents: 10000,
      });
      expect(result).toBeNull();
    });

    it('creates commission and updates referral when referral exists and not self-referral', async () => {
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        convertedAt: null,
        affiliateId: 'aff1',
        affiliate: { status: 'APPROVED', commissionRatePercent: 10 },
      });
      mockFindUnique.mockResolvedValue({ email: 'aff@x.com', user: null });
      mockCommissionCreate.mockResolvedValue({ id: 'comm1' });
      mockReferralUpdate.mockResolvedValue({});
      const result = await createCommissionForFirstPayment({
        userId: 'u1',
        workspaceId: 'w1',
        userEmail: 'u@x.com',
        planId: 'p1',
        valueCents: 10000,
      });
      expect(result).toEqual({ id: 'comm1' });
      expect(mockCommissionCreate).toHaveBeenCalled();
      expect(mockReferralUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: expect.objectContaining({ convertedAt: expect.any(Date), planId: 'p1', valueCents: 10000 }),
      });
    });
  });

  describe('createCommissionForRecurring', () => {
    const { createCommissionForRecurring } = require('@/lib/affiliate');
    const findUniqueSettings = prisma.affiliateSettings.findUnique as jest.Mock;

    it('returns null when commissionRule is not RECURRING', async () => {
      findUniqueSettings.mockResolvedValue({ commissionRule: 'FIRST_PAYMENT_ONLY', approvalHoldDays: 15 });
      const result = await createCommissionForRecurring({
        workspaceId: 'w1',
        subscriptionId: 'sub1',
        planId: 'p1',
        valueCents: 5000,
      });
      expect(result).toBeNull();
    });

    it('returns null when existingCount is 0', async () => {
      findUniqueSettings.mockResolvedValue({ commissionRule: 'RECURRING', approvalHoldDays: 15 });
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        affiliateId: 'aff1',
        affiliate: { status: 'APPROVED', commissionRatePercent: 10 },
      });
      mockCount.mockResolvedValue(0);
      const result = await createCommissionForRecurring({
        workspaceId: 'w1',
        subscriptionId: 'sub1',
        planId: 'p1',
        valueCents: 5000,
      });
      expect(result).toBeNull();
    });

    it('returns null when orderId already has commission (idempotence)', async () => {
      findUniqueSettings.mockResolvedValue({ commissionRule: 'RECURRING', approvalHoldDays: 15 });
      mockCommissionFindFirst.mockResolvedValue({ id: 'existing' });
      const result = await createCommissionForRecurring({
        workspaceId: 'w1',
        subscriptionId: 'sub1',
        planId: 'p1',
        valueCents: 5000,
        orderId: 'ord-1',
      });
      expect(result).toBeNull();
    });

    it('creates recurring commission when referral exists and existingCount > 0', async () => {
      findUniqueSettings.mockResolvedValue({ commissionRule: 'RECURRING', approvalHoldDays: 15 });
      mockReferralFindFirst.mockResolvedValue({
        id: 'r1',
        affiliateId: 'aff1',
        affiliate: { status: 'APPROVED', commissionRatePercent: 10 },
      });
      mockCount.mockResolvedValue(1);
      mockCommissionCreate.mockResolvedValue({ id: 'rec-1' });
      const result = await createCommissionForRecurring({
        workspaceId: 'w1',
        subscriptionId: 'sub1',
        planId: 'p1',
        valueCents: 5000,
      });
      expect(result).toEqual({ id: 'rec-1' });
      expect(mockCommissionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            commissionType: 'RECURRING',
            subscriptionId: 'sub1',
            status: 'PENDING',
          }),
        })
      );
    });
  });
});
