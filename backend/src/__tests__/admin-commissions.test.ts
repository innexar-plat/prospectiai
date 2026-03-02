/**
 * Admin commissions API: GET list.
 */
const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    affiliateCommission: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}));

import { GET } from '@/app/api/admin/commissions/route';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { NextRequest } from 'next/server';

describe('GET /api/admin/commissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1', email: 'admin@test.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(auth).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/admin/commissions');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    jest.mocked(isAdmin).mockReturnValue(false);
    const req = new NextRequest('http://localhost/api/admin/commissions');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns paginated list when admin', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'c1',
        affiliateId: 'a1',
        amountCents: 1000,
        currency: 'BRL',
        status: 'APPROVED',
        availableAt: new Date('2025-01-15'),
        paidAt: null,
        commissionType: 'FIRST_PAYMENT',
        createdAt: new Date('2025-01-01'),
        paymentProofUrl: null,
        affiliate: {
          id: 'a1',
          code: 'ABC123',
          name: 'Affiliate One',
          email: 'aff@test.com',
          user: { email: 'user@test.com' },
        },
      },
    ]);
    mockCount.mockResolvedValue(1);
    const req = new NextRequest('http://localhost/api/admin/commissions?limit=20&offset=0');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe('c1');
    expect(data.items[0].affiliateCode).toBe('ABC123');
    expect(data.items[0].affiliateName).toBe('Affiliate One');
    expect(data.items[0].amountCents).toBe(1000);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
  });

  it('applies status filter', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    const req = new NextRequest('http://localhost/api/admin/commissions?status=APPROVED');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'APPROVED' },
      })
    );
  });
});
