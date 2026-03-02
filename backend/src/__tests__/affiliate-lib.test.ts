/**
 * Unit tests for affiliate lib (with Prisma mocks).
 */
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateMany = jest.fn();
const mockCount = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    affiliate: {
      findFirst: mockFindFirst,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      create: mockCreate,
    },
    affiliateSettings: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    referral: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    affiliateCommission: {
      create: jest.fn(),
      updateMany: mockUpdateMany,
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: mockCount,
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
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
});
