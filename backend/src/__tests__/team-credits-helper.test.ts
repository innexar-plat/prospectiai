const { getMemberUsage, checkMemberLimits, MemberLimitExceededError } = require('@/lib/team-credits');
const { prisma } = require('@/lib/prisma');

jest.mock('@/lib/prisma', () => ({
  prisma: {
    searchHistory: { count: jest.fn() },
    leadAnalysis: { count: jest.fn() },
  },
}));

describe('team-credits helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMemberUsage', () => {
    it('returns today, week, month counts (search + analysis)', async () => {
      (prisma.searchHistory.count as jest.Mock)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);
      (prisma.leadAnalysis.count as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4);

      const result = await getMemberUsage(prisma, 'w1', 'u1');
      expect(result).toEqual({ today: 3, week: 8, month: 14 });
      expect(prisma.searchHistory.count).toHaveBeenCalledTimes(3);
      expect(prisma.leadAnalysis.count).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkMemberLimits', () => {
    it('does nothing when no limits set', async () => {
      await checkMemberLimits(
        prisma,
        { dailyLeadsLimit: null, weeklyLeadsLimit: null, monthlyLeadsLimit: null },
        'w1',
        'u1',
      );
      expect(prisma.searchHistory.count).not.toHaveBeenCalled();
      expect(prisma.leadAnalysis.count).not.toHaveBeenCalled();
    });

    it('throws MemberLimitExceededError when daily limit exceeded', async () => {
      (prisma.searchHistory.count as jest.Mock).mockResolvedValue(5);
      (prisma.leadAnalysis.count as jest.Mock).mockResolvedValue(5);
      const membership = {
        dailyLeadsLimit: 10,
        weeklyLeadsLimit: null,
        monthlyLeadsLimit: null,
      };
      let err: InstanceType<typeof MemberLimitExceededError> | null = null;
      try {
        await checkMemberLimits(prisma, membership, 'w1', 'u1');
      } catch (e) {
        err = e as InstanceType<typeof MemberLimitExceededError>;
      }
      expect(err).toBeInstanceOf(MemberLimitExceededError);
      expect(err?.period).toBe('daily');
      expect(err?.used).toBe(10);
      expect(err?.limit).toBe(10);
      expect(err?.code).toBe('MEMBER_LIMIT_EXCEEDED');
    });

    it('throws when weekly limit exceeded', async () => {
      (prisma.searchHistory.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(0);
      (prisma.leadAnalysis.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);
      const membership = {
        dailyLeadsLimit: null,
        weeklyLeadsLimit: 20,
        monthlyLeadsLimit: null,
      };
      let err: InstanceType<typeof MemberLimitExceededError> | null = null;
      try {
        await checkMemberLimits(prisma, membership, 'w1', 'u1');
      } catch (e) {
        err = e as InstanceType<typeof MemberLimitExceededError>;
      }
      expect(err).toBeInstanceOf(MemberLimitExceededError);
      expect(err?.period).toBe('weekly');
      expect(err?.used).toBe(25);
      expect(err?.limit).toBe(20);
    });

    it('throws when monthly limit exceeded', async () => {
      (prisma.searchHistory.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(100);
      (prisma.leadAnalysis.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50);
      const membership = {
        dailyLeadsLimit: null,
        weeklyLeadsLimit: null,
        monthlyLeadsLimit: 100,
      };
      let err: InstanceType<typeof MemberLimitExceededError> | null = null;
      try {
        await checkMemberLimits(prisma, membership, 'w1', 'u1');
      } catch (e) {
        err = e as InstanceType<typeof MemberLimitExceededError>;
      }
      expect(err).toBeInstanceOf(MemberLimitExceededError);
      expect(err?.period).toBe('monthly');
      expect(err?.used).toBe(150);
      expect(err?.limit).toBe(100);
    });

    it('does not throw when usage below limits', async () => {
      (prisma.searchHistory.count as jest.Mock).mockResolvedValue(1);
      (prisma.leadAnalysis.count as jest.Mock).mockResolvedValue(1);
      const membership = {
        dailyLeadsLimit: 10,
        weeklyLeadsLimit: 50,
        monthlyLeadsLimit: 200,
      };
      await expect(
        checkMemberLimits(prisma, membership, 'w1', 'u1'),
      ).resolves.toBeUndefined();
    });
  });
});
