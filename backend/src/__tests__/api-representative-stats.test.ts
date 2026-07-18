import { GET } from '@/app/api/admin/representatives/stats/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { count: jest.fn(), aggregate: jest.fn() },
    repCommission: { count: jest.fn(), aggregate: jest.fn() },
    repClient: { count: jest.fn() },
  },
}));

describe('GET /api/admin/representatives/stats', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(auth).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'x@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('only counts PAID commissions toward the paid totals, not pending/approved', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);

    prisma.representative.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prisma.repCommission.count
      .mockResolvedValueOnce(3) // month paid count
      .mockResolvedValueOnce(9); // year paid count
    prisma.repClient.count
      .mockResolvedValueOnce(50) // totalClients (all statuses)
      .mockResolvedValueOnce(12) // totalLeads
      .mockResolvedValueOnce(30); // totalActiveClients
    prisma.representative.aggregate.mockResolvedValueOnce({ _sum: { linkClicks: 777 } });
    prisma.repCommission.aggregate
      .mockResolvedValueOnce({ _sum: { amountCents: 100000 } }) // BR all-time, not-cancelled
      .mockResolvedValueOnce({ _sum: { amountCents: 5000 } }) // BR month, PAID only
      .mockResolvedValueOnce({ _sum: { amountCents: 20000 } }) // BR year, PAID only
      .mockResolvedValueOnce({ _sum: { amountCents: 0 } }) // US all-time, not-cancelled
      .mockResolvedValueOnce({ _sum: { amountCents: 0 } }) // US month, PAID only
      .mockResolvedValueOnce({ _sum: { amountCents: 0 } }); // US year, PAID only

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalCommissionsPaidMonthCents).toBe(5000);
    expect(body.totalCommissionsPaidYearCents).toBe(20000);
    expect(body.totalRevenueGeneratedCents).toBe(100000);
    expect(body.totalRevenueGenerated).toBe(1000);
    expect(body.totalClientsGenerated).toBe(50);
    expect(body.totalLeads).toBe(12);
    expect(body.totalActiveClients).toBe(30);
    expect(body.totalLinkClicks).toBe(777);

    // BR and US commissions are segmented, not summed together into one currency.
    expect(body.byCurrency.BRL).toEqual({
      totalCommissionsPaidMonthCents: 5000,
      totalCommissionsPaidYearCents: 20000,
      totalRevenueGeneratedCents: 100000,
    });
    expect(body.byCurrency.USD).toEqual({
      totalCommissionsPaidMonthCents: 0,
      totalCommissionsPaidYearCents: 0,
      totalRevenueGeneratedCents: 0,
    });

    // The month/year "paid" aggregates must be scoped to PAID status, not just non-cancelled.
    expect(prisma.repCommission.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ status: 'PAID' }),
    }));
    expect(prisma.repCommission.aggregate).toHaveBeenNthCalledWith(3, expect.objectContaining({
      where: expect.objectContaining({ status: 'PAID' }),
    }));
  });

  it('defaults sums to 0 when there are no commissions', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);

    prisma.representative.count.mockResolvedValue(0);
    prisma.repCommission.count.mockResolvedValue(0);
    prisma.repClient.count.mockResolvedValue(0);
    prisma.repCommission.aggregate.mockResolvedValue({ _sum: { amountCents: null } });
    prisma.representative.aggregate.mockResolvedValue({ _sum: { linkClicks: null } });

    const res = await GET();
    const body = await res.json();
    expect(body.totalCommissionsPaidMonthCents).toBe(0);
    expect(body.totalCommissionsPaidYearCents).toBe(0);
    expect(body.totalRevenueGeneratedCents).toBe(0);
    expect(body.totalRevenueGenerated).toBe(0);
    expect(body.totalLinkClicks).toBe(0);
  });
});
