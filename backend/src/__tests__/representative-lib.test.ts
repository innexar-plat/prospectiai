const mockFindUnique = jest.fn();
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockCount = jest.fn();
const mockAggregate = jest.fn();
const mockWorkspaceCreate = jest.fn();
const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockTransaction = jest.fn();
const mockRepClientFindFirst = jest.fn();
const mockRepClientCreate = jest.fn();

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    repCommission: {
      findUnique: jest.fn(),
      aggregate: mockAggregate,
      update: jest.fn(),
    },
    repGoal: {
      findUnique: jest.fn(),
    },
    repClient: {
      count: mockCount,
      findFirst: mockRepClientFindFirst,
      create: mockRepClientCreate,
    },
    repLevelConfig: {
      findUnique: jest.fn(),
    },
    affiliate: {
      findUnique: jest.fn(),
    },
    workspace: {
      create: mockWorkspaceCreate,
    },
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
    },
    $transaction: mockTransaction,
  },
}));

const prisma = require('@/lib/prisma').prisma;

// $transaction just runs the callback against the same mocked prisma client (acting as `tx`).
mockTransaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));

describe('representative lib', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRepresentative', () => {
    const { getRepresentative } = require('@/lib/representative');

    it('returns null when session is null', async () => {
      expect(await getRepresentative(null)).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns null when session has no user', async () => {
      expect(await getRepresentative({} as never)).toBeNull();
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('calls findUnique with userId', async () => {
      const rep = { id: 'r1', name: 'João' };
      mockFindUnique.mockResolvedValue(rep);
      const result = await getRepresentative({ user: { id: 'u1' } } as never);
      expect(result).toEqual(rep);
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('returns null when no rep found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await getRepresentative({ user: { id: 'u1' } } as never);
      expect(result).toBeNull();
    });
  });

  describe('buildRepLink', () => {
    const { buildRepLink } = require('@/lib/representative');

    it('builds link with code', () => {
      expect(buildRepLink('ABC123', 'https://example.com')).toBe('https://example.com/?rep=ABC123');
    });

    it('removes trailing slash from siteUrl', () => {
      expect(buildRepLink('XYZ', 'https://site.com/')).toBe('https://site.com/?rep=XYZ');
    });
  });

  describe('getRepByCode', () => {
    const { getRepByCode } = require('@/lib/representative');

    it('returns null for empty code', async () => {
      expect(await getRepByCode('')).toBeNull();
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('returns null for non-string', async () => {
      expect(await getRepByCode(null as unknown as string)).toBeNull();
      expect(mockFindFirst).not.toHaveBeenCalled();
    });

    it('calls findFirst with the trimmed code, preserving case (it is a lowercase cuid, not an uppercase-normalized code)', async () => {
      mockFindFirst.mockResolvedValue({ id: 'cmrabc123', name: 'Rep' });
      const result = await getRepByCode('  cmrabc123  ');
      expect(mockFindFirst).toHaveBeenCalledWith({ where: { id: 'cmrabc123' } });
      expect(result).toEqual({ id: 'cmrabc123', name: 'Rep' });
    });

    it('returns null when not found', async () => {
      mockFindFirst.mockResolvedValue(null);
      expect(await getRepByCode('XYZ')).toBeNull();
    });
  });

  describe('getRepByWorkspaceId', () => {
    const { getRepByWorkspaceId } = require('@/lib/representative');

    it('calls findUnique with workspaceId', async () => {
      mockFindUnique.mockResolvedValue({ id: 'r1' });
      const result = await getRepByWorkspaceId('ws1');
      expect(result).toEqual({ id: 'r1' });
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { workspaceId: 'ws1' } });
    });

    it('returns null when not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await getRepByWorkspaceId('ws1')).toBeNull();
    });
  });

  describe('attachRepLeadOnSignup', () => {
    const { attachRepLeadOnSignup } = require('@/lib/representative');
    const activeRep = { id: 'cmrrep1', email: 'rep@x.com', userId: 'rep-user-1', status: 'ACTIVE' };

    it('does nothing when the rep code does not match an active representative', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'new@x.com' });
      expect(mockRepClientCreate).not.toHaveBeenCalled();
    });

    it('does nothing when the representative is not ACTIVE', async () => {
      mockFindFirst.mockResolvedValueOnce({ ...activeRep, status: 'SUSPENDED' });
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'new@x.com' });
      expect(mockRepClientCreate).not.toHaveBeenCalled();
    });

    it('does nothing on self-referral by email', async () => {
      mockFindFirst.mockResolvedValueOnce(activeRep);
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'someone-else', workspaceId: 'w1', email: 'REP@X.COM' });
      expect(mockRepClientCreate).not.toHaveBeenCalled();
    });

    it('does nothing on self-referral by userId', async () => {
      mockFindFirst.mockResolvedValueOnce(activeRep);
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'rep-user-1', workspaceId: 'w1', email: 'different@x.com' });
      expect(mockRepClientCreate).not.toHaveBeenCalled();
    });

    it('does nothing when a RepClient already exists for this workspace (avoids duplicates)', async () => {
      mockFindFirst.mockResolvedValueOnce(activeRep);
      mockRepClientFindFirst.mockResolvedValueOnce({ id: 'existing-client' });
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'new@x.com' });
      expect(mockRepClientCreate).not.toHaveBeenCalled();
    });

    it('creates a LEAD RepClient for a valid, non-self referral', async () => {
      mockFindFirst.mockResolvedValueOnce(activeRep);
      mockRepClientFindFirst.mockResolvedValueOnce(null);
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'new@x.com', name: 'New User' });
      expect(mockRepClientCreate).toHaveBeenCalledWith({
        data: {
          representativeId: 'cmrrep1',
          workspaceId: 'w1',
          name: 'New User',
          email: 'new@x.com',
          status: 'LEAD',
        },
      });
    });

    it('falls back to email as the client name when no name is given', async () => {
      mockFindFirst.mockResolvedValueOnce(activeRep);
      mockRepClientFindFirst.mockResolvedValueOnce(null);
      await attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'noname@x.com' });
      expect(mockRepClientCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'noname@x.com' }) }),
      );
    });

    it('swallows errors instead of throwing (signup must succeed even if lead attribution fails)', async () => {
      mockFindFirst.mockRejectedValueOnce(new Error('db down'));
      await expect(
        attachRepLeadOnSignup({ repCode: 'cmrrep1', userId: 'u1', workspaceId: 'w1', email: 'new@x.com' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('createRepresentative', () => {
    const { createRepresentative } = require('@/lib/representative');
    const adminId = 'admin1';

    it('throws when email already used by another representative', async () => {
      mockFindUnique.mockResolvedValue({ id: 'existing', email: 'rep@x.com' });
      await expect(createRepresentative({ name: 'João', email: 'Rep@X.COM' }, adminId)).rejects.toThrow('Email already used');
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('throws when the matching user is already a representative', async () => {
      mockFindUnique
        .mockResolvedValueOnce(null) // representative.findUnique by email -> no rep with this email
        .mockResolvedValueOnce({ id: 'rep-existing' }); // representative.findUnique by userId -> already a rep
      mockUserFindUnique.mockResolvedValue({ id: 'u1', email: 'joao@x.com' });

      await expect(createRepresentative({ name: 'João', email: 'joao@x.com' }, adminId)).rejects.toThrow('já é um representante');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('promotes an existing user without creating a new account', async () => {
      mockFindUnique
        .mockResolvedValueOnce(null) // no rep with this email
        .mockResolvedValueOnce(null); // existing user is not yet a rep
      mockUserFindUnique.mockResolvedValue({ id: 'existing-user', email: 'joao@x.com' });
      mockWorkspaceCreate.mockResolvedValue({ id: 'ws1' });
      mockCreate.mockResolvedValue({ id: 'r1', name: 'João', email: 'joao@x.com', userId: 'existing-user' });

      const result = await createRepresentative({ name: 'João', email: 'joao@x.com' }, adminId);

      expect(result.accountCreated).toBe(false);
      expect(result.resetToken).toBeUndefined();
      expect(result.rep).toEqual({ id: 'r1', name: 'João', email: 'joao@x.com', userId: 'existing-user' });
      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(mockWorkspaceCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ members: { create: { userId: 'existing-user', role: 'OWNER' } } }),
      }));
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: 'existing-user', workspaceId: 'ws1', createdByAdminId: adminId }),
      }));
    });

    it('creates a new user with a reset token when the email has no account', async () => {
      mockFindUnique.mockResolvedValueOnce(null); // no rep with this email
      mockUserFindUnique.mockResolvedValue(null); // no existing user
      mockUserCreate.mockResolvedValue({ id: 'new-user', email: 'maria@x.com' });
      mockWorkspaceCreate.mockResolvedValue({ id: 'ws2' });
      mockCreate.mockResolvedValue({ id: 'r2', name: 'Maria', email: 'maria@x.com', userId: 'new-user' });

      const result = await createRepresentative({ name: 'Maria', email: 'maria@x.com' }, adminId);

      expect(result.accountCreated).toBe(true);
      expect(result.resetToken).toEqual(expect.any(String));
      const { hashToken } = require('@/lib/auth-utils');
      expect(mockUserCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ email: 'maria@x.com', resetTokenHash: hashToken(result.resetToken!) }),
      }));
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: 'new-user', workspaceId: 'ws2', createdByAdminId: adminId }),
      }));
    });

    it('uses default values', async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ id: 'new-user-2', email: 'maria2@x.com' });
      mockWorkspaceCreate.mockResolvedValue({ id: 'ws3' });
      mockCreate.mockResolvedValue({ id: 'r3' });

      await createRepresentative({ name: 'Maria', email: 'maria2@x.com' }, adminId);
      const args = mockCreate.mock.calls[0][0];
      expect(args.data.directCommissionPct).toBe(20);
      expect(args.data.affiliateOverridePct).toBe(5);
      expect(args.data.commissionHoldDays).toBe(30);
      expect(args.data.creditLimit).toBe(500);
      expect(args.data.level).toBe('BRONZE');
    });
  });

  describe('updateCommissionStatus', () => {
    const { updateCommissionStatus } = require('@/lib/representative');
    const mockCommissionFindUnique = prisma.repCommission.findUnique;
    const mockCommissionUpdate = prisma.repCommission.update;

    it('throws when commission not found', async () => {
      mockCommissionFindUnique.mockResolvedValue(null);
      await expect(updateCommissionStatus('c1', 'PAID', 'admin1')).rejects.toThrow('Commission not found');
    });

    it('sets holdUntil when approving', async () => {
      mockCommissionFindUnique.mockResolvedValue({ id: 'c1' });
      mockCommissionUpdate.mockResolvedValue({ id: 'c1', status: 'APPROVED' });
      const result = await updateCommissionStatus('c1', 'APPROVED', 'admin1');
      expect(result).toEqual({ id: 'c1', status: 'APPROVED' });
      expect(mockCommissionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ status: 'APPROVED', holdUntil: expect.any(Date) }),
        }),
      );
    });

    it('sets paidAt and paidByAdminId when paying', async () => {
      mockCommissionFindUnique.mockResolvedValue({ id: 'c1' });
      mockCommissionUpdate.mockResolvedValue({ id: 'c1', status: 'PAID' });
      const result = await updateCommissionStatus('c1', 'PAID', 'admin1');
      expect(result).toEqual({ id: 'c1', status: 'PAID' });
      expect(mockCommissionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ status: 'PAID', paidAt: expect.any(Date), paidByAdminId: 'admin1' }),
        }),
      );
    });
  });

  describe('calculateOverride', () => {
    const { calculateOverride } = require('@/lib/representative');
    const mockAffiliateFindUnique = prisma.affiliate.findUnique;

    it('returns null when affiliate not found', async () => {
      mockAffiliateFindUnique.mockResolvedValue(null);
      expect(await calculateOverride('aff1', 10000)).toBeNull();
    });

    it('returns null when affiliate has no representative', async () => {
      mockAffiliateFindUnique.mockResolvedValue({ id: 'aff1', representativeId: null, representative: null });
      expect(await calculateOverride('aff1', 10000)).toBeNull();
    });

    it('calculates override amount correctly', async () => {
      mockAffiliateFindUnique.mockResolvedValue({
        id: 'aff1',
        representativeId: 'r1',
        representative: { id: 'r1', affiliateOverridePct: 10 },
      });
      const result = await calculateOverride('aff1', 20000);
      expect(result).toEqual({ representativeId: 'r1', amountCents: 2000, percent: 10 });
    });

    it('returns null when calculated amount is 0', async () => {
      mockAffiliateFindUnique.mockResolvedValue({
        id: 'aff1',
        representativeId: 'r1',
        representative: { id: 'r1', affiliateOverridePct: 0 },
      });
      expect(await calculateOverride('aff1', 5000)).toBeNull();
    });
  });

  describe('getRepDashboard', () => {
    const { getRepDashboard } = require('@/lib/representative');
    const mockGoalFindUnique = prisma.repGoal.findUnique;

    it('returns null when rep not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await getRepDashboard('r1')).toBeNull();
    });

    it('returns dashboard with aggregated data', async () => {
      mockFindUnique.mockResolvedValue({
        id: 'r1', name: 'Rep', email: 'rep@x.com', level: 'GOLD',
        status: 'ACTIVE', directCommissionPct: 20, affiliateOverridePct: 5,
        commissionHoldDays: 30, creditLimit: 1000, minPayoutCents: 5000,
        monthlyGoalCents: 100000, region: 'SP', payoutType: 'PIX',
        payoutPayload: '0000', lastActivityAt: null, createdAt: new Date('2025-01-01'),
        linkClicks: 42,
      });
      mockAggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 50000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 10000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 15000 } });
      mockCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(4);
      mockGoalFindUnique.mockResolvedValue({
        targetCents: 100000,
        achievedCents: 45000,
      });

      const dash = await getRepDashboard('r1');
      expect(dash).not.toBeNull();
      expect(dash!.name).toBe('Rep');
      expect(dash!.level).toBe('GOLD');
      expect(dash!.balanceCents).toBe(40000);
      expect(dash!.pendingCents).toBe(10000);
      expect(dash!.totalClients).toBe(10);
      expect(dash!.monthClientCount).toBe(3);
      expect(dash!.monthCommissionCents).toBe(15000);
      expect(dash!.goalProgress).toEqual({ targetCents: 100000, achievedCents: 45000, percent: 45 });
      expect(dash!.linkClicks).toBe(42);
      expect(dash!.leadsCount).toBe(6);
      expect(dash!.activeClientsCount).toBe(4);
    });

    it('returns goalProgress as null when no goal set', async () => {
      const mockGoalFindUnique = prisma.repGoal.findUnique;
      mockGoalFindUnique.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue({
        id: 'r1', name: 'Rep', email: 'rep@x.com', level: 'BRONZE',
        status: 'ACTIVE', directCommissionPct: 15, affiliateOverridePct: 3,
        commissionHoldDays: 30, creditLimit: 500, minPayoutCents: 5000,
        monthlyGoalCents: null, region: null, payoutType: null,
        payoutPayload: null, lastActivityAt: null, createdAt: new Date('2025-01-01'),
        linkClicks: 0,
      });
      mockAggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 0 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 0 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 0 } });
      mockCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const dash = await getRepDashboard('r1');
      expect(dash!.goalProgress).toBeNull();
      expect(dash!.leadsCount).toBe(0);
      expect(dash!.activeClientsCount).toBe(0);
    });
  });

  describe('getRepBalance', () => {
    const { getRepBalance } = require('@/lib/representative');

    it('returns zero when no commissions', async () => {
      mockAggregate
        .mockResolvedValueOnce({ _sum: { amountCents: null } })
        .mockResolvedValueOnce({ _sum: { amountCents: null } });
      const bal = await getRepBalance('r1');
      expect(bal).toEqual({ availableCents: 0, approvedCents: 0, paidCents: 0 });
    });

    it('calculates available balance', async () => {
      mockAggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 30000 } })
        .mockResolvedValueOnce({ _sum: { amountCents: 20000 } });
      const bal = await getRepBalance('r1');
      expect(bal).toEqual({ availableCents: 10000, approvedCents: 30000, paidCents: 20000 });
    });
  });

  describe('applyLevelDefaults', () => {
    const { applyLevelDefaults } = require('@/lib/representative');
    const mockLevelConfigFindUnique = prisma.repLevelConfig.findUnique;

    it('returns null when rep not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      expect(await applyLevelDefaults('r1')).toBeNull();
    });

    it('returns null when level config not found', async () => {
      mockFindUnique.mockResolvedValue({ id: 'r1', level: 'PLATINUM' });
      mockLevelConfigFindUnique.mockResolvedValue(null);
      expect(await applyLevelDefaults('r1')).toBeNull();
    });

    it('updates rep with level defaults', async () => {
      mockFindUnique.mockResolvedValue({ id: 'r1', level: 'PLATINUM' });
      mockLevelConfigFindUnique.mockResolvedValue({
        level: 'PLATINUM',
        directCommissionPct: 30,
        affiliateOverridePct: 10,
        creditLimit: 5000,
        minPayoutCents: 3000,
        monthlyGoalCents: 300000,
      });
      mockUpdate.mockResolvedValue({ id: 'r1', level: 'PLATINUM' });

      const result = await applyLevelDefaults('r1');
      expect(result).toEqual({ id: 'r1', level: 'PLATINUM' });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: {
          directCommissionPct: 30,
          affiliateOverridePct: 10,
          creditLimit: 5000,
          minPayoutCents: 3000,
          monthlyGoalCents: 300000,
        },
      });
    });
  });

  describe('getMonthlyGoalProgress', () => {
    const { getMonthlyGoalProgress } = require('@/lib/representative');
    const mockGoalFindUnique = prisma.repGoal.findUnique;

    it('calls findUnique with composite key', async () => {
      mockGoalFindUnique.mockResolvedValue({ representativeId: 'r1', month: 7, year: 2025, targetCents: 50000 });
      const result = await getMonthlyGoalProgress('r1', 7, 2025);
      expect(result).toEqual({ representativeId: 'r1', month: 7, year: 2025, targetCents: 50000 });
      expect(mockGoalFindUnique).toHaveBeenCalledWith({
        where: { representativeId_month_year: { representativeId: 'r1', month: 7, year: 2025 } },
      });
    });
  });
});
