import { GET as getDashboard } from '@/app/api/representative/dashboard/route';
import { GET as getCommissions } from '@/app/api/representative/commissions/route';
import { GET as getAdminReps, POST as postAdminRep } from '@/app/api/admin/representatives/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    repCommission: { findMany: jest.fn() },
    repClient: { findMany: jest.fn() },
    repGoal: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/representative', () => ({
  getRepDashboard: jest.fn(),
  getRepBalance: jest.fn(),
  buildRepLink: jest.fn(() => 'https://x.com/?rep=CODE'),
  createRepresentative: jest.fn(),
}));
jest.mock('@/lib/email', () => ({
  sendRepresentativeInviteEmail: jest.fn().mockResolvedValue({ sent: true }),
  sendRepresentativePromotedEmail: jest.fn().mockResolvedValue({ sent: true }),
}));
jest.mock('@/lib/i18n/locale', () => ({ getRequestLocale: jest.fn(() => 'pt') }));
jest.mock('@/lib/site-url', () => ({ getSiteUrlFromRequest: jest.fn(() => 'https://x.com') }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

const mockReq = (url = 'http://localhost') => new NextRequest(new Request(url));

describe('Representative API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/representative/dashboard', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await getDashboard(mockReq());
      expect(res.status).toBe(401);
    });

    it('returns 404 when rep not found', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue(null);
      const res = await getDashboard(mockReq());
      expect(res.status).toBe(404);
    });

    it('returns dashboard data when rep exists', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
      const { getRepDashboard, getRepBalance } = require('@/lib/representative');
      getRepDashboard.mockResolvedValue({ id: 'r1', name: 'Rep', balanceCents: 1000 });
      getRepBalance.mockResolvedValue({ availableCents: 500 });
      prisma.repCommission.findMany.mockResolvedValue([]);
      prisma.repClient.findMany.mockResolvedValue([]);

      const res = await getDashboard(mockReq());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dashboard).toBeDefined();
      expect(body.balance).toBeDefined();
      expect(body.disclosureLink).toBe('https://x.com/?rep=CODE');
    });
  });

  describe('GET /api/representative/commissions', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await getCommissions(mockReq());
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/admin/representatives', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await getAdminReps(mockReq());
      expect(res.status).toBe(401);
    });

    it('returns 403 when not admin', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'user@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(false);
      const res = await getAdminReps(mockReq());
      expect(res.status).toBe(403);
    });

    it('returns paginated list when admin', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const fakeRep = (id: string, name: string, email: string, level: string) => ({
        id, name, email, level, status: 'ACTIVE',
        phone: null, document: null, region: null, notes: null,
        directCommissionPct: 20, affiliateOverridePct: 5, commissionHoldDays: 30,
        creditLimit: 500, minPayoutCents: 5000, monthlyGoalCents: null,
        userId: null, workspaceId: 'ws1', createdByAdminId: 'admin1',
        payoutType: null, payoutPayload: null, lastActivityAt: null,
        createdAt: new Date('2025-06-01'),
        updatedAt: new Date('2025-06-01'),
        _count: { clients: 3, commissions: 5, affiliates: 1 },
        user: null,
      });
      prisma.representative.findMany.mockResolvedValue([
        fakeRep('r1', 'Rep 1', 'r1@x.com', 'GOLD'),
        fakeRep('r2', 'Rep 2', 'r2@x.com', 'BRONZE'),
      ]);
      prisma.representative.count.mockResolvedValue(10);

      const res = await getAdminReps(mockReq());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(10);
    });
  });

  describe('POST /api/admin/representatives', () => {
    const postReq = (payload: Record<string, unknown>) =>
      new NextRequest(new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));

    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await postAdminRep(postReq({ name: 'João', email: 'joao@x.com' }));
      expect(res.status).toBe(401);
    });

    it('returns 403 when not admin', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'user@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(false);
      const res = await postAdminRep(postReq({ name: 'João', email: 'joao@x.com' }));
      expect(res.status).toBe(403);
    });

    it('sends an invite email and reports accountCreated=true for a brand new email', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const { createRepresentative } = require('@/lib/representative');
      const { sendRepresentativeInviteEmail, sendRepresentativePromotedEmail } = require('@/lib/email');
      createRepresentative.mockResolvedValue({
        rep: { id: 'r1', name: 'Maria', email: 'maria@x.com', level: 'BRONZE', status: 'ACTIVE' },
        accountCreated: true,
        resetToken: 'abc123',
      });

      const res = await postAdminRep(postReq({ name: 'Maria', email: 'maria@x.com' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accountCreated).toBe(true);
      expect(sendRepresentativeInviteEmail).toHaveBeenCalledWith(
        'maria@x.com',
        expect.stringContaining('/reset-password?token=abc123'),
        'pt',
        'https://x.com',
      );
      expect(sendRepresentativePromotedEmail).not.toHaveBeenCalled();
    });

    it('uses the explicit market from the form instead of guessing from the request host', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const { createRepresentative } = require('@/lib/representative');
      createRepresentative.mockResolvedValue({
        rep: { id: 'r1', name: 'Maria', email: 'maria@x.com', level: 'BRONZE', status: 'ACTIVE' },
        accountCreated: true,
        resetToken: 'abc123',
      });

      // Request itself looks like a BR host (default), but the admin explicitly chose US.
      await postAdminRep(postReq({ name: 'Maria', email: 'maria@x.com', market: 'US' }));

      expect(createRepresentative).toHaveBeenCalledWith(
        expect.objectContaining({ market: 'US' }),
        'admin1',
      );
    });

    it('falls back to the request-host market when none is provided explicitly', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const { createRepresentative } = require('@/lib/representative');
      createRepresentative.mockResolvedValue({
        rep: { id: 'r1', name: 'Maria', email: 'maria@x.com', level: 'BRONZE', status: 'ACTIVE' },
        accountCreated: true,
        resetToken: 'abc123',
      });

      await postAdminRep(postReq({ name: 'Maria', email: 'maria@x.com' }));

      expect(createRepresentative).toHaveBeenCalledWith(
        expect.objectContaining({ market: 'BR' }),
        'admin1',
      );
    });

    it('sends a promoted-account email and reports accountCreated=false for an existing user', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const { createRepresentative } = require('@/lib/representative');
      const { sendRepresentativeInviteEmail, sendRepresentativePromotedEmail } = require('@/lib/email');
      createRepresentative.mockResolvedValue({
        rep: { id: 'r2', name: 'João', email: 'joao@x.com', level: 'BRONZE', status: 'ACTIVE' },
        accountCreated: false,
      });

      const res = await postAdminRep(postReq({ name: 'João', email: 'joao@x.com' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.accountCreated).toBe(false);
      expect(sendRepresentativePromotedEmail).toHaveBeenCalledWith('joao@x.com', 'https://x.com/dashboard', 'pt', 'https://x.com');
      expect(sendRepresentativeInviteEmail).not.toHaveBeenCalled();
    });

    it('returns 400 with the error message when createRepresentative throws', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
      jest.mocked(isAdmin).mockReturnValue(true);
      const { createRepresentative } = require('@/lib/representative');
      createRepresentative.mockRejectedValue(new Error('Este usuário já é um representante.'));

      const res = await postAdminRep(postReq({ name: 'João', email: 'joao@x.com' }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Este usuário já é um representante.');
    });
  });
});
