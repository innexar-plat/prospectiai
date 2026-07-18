import { GET, POST } from '@/app/api/admin/representatives/[id]/goals/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn() },
    repGoal: { findMany: jest.fn(), upsert: jest.fn() },
  },
}));

function goalsRequest(body: unknown) {
  return new Request('http://localhost/api/admin/representatives/rep1/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: 'rep1' }) };

describe('POST /api/admin/representatives/[id]/goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);
    jest.mocked(prisma.representative.findUnique).mockResolvedValue({ id: 'rep1' } as never);
  });

  it('rejects a payload without targetCents (regression: admin used to send targetAmount)', async () => {
    const res = await POST(goalsRequest({ month: 7, year: 2026, targetAmount: 50000 }), ctx);
    expect(res.status).toBe(400);
    expect(prisma.repGoal.upsert).not.toHaveBeenCalled();
  });

  it('accepts a valid targetCents payload and stores cents as-is (no unit conversion server-side)', async () => {
    jest.mocked(prisma.repGoal.upsert).mockResolvedValue({
      id: 'goal1',
      targetCents: 50000,
      achievedCents: 0,
      month: 7,
      year: 2026,
      createdAt: new Date('2026-07-01'),
      updatedAt: new Date('2026-07-01'),
    } as never);

    const res = await POST(goalsRequest({ month: 7, year: 2026, targetCents: 50000 }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.targetAmount).toBe(50000);
    expect(prisma.repGoal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ targetCents: 50000 }),
      }),
    );
  });

  it('rejects a non-integer targetCents (e.g. reais sent unconverted, like 500.50)', async () => {
    const res = await POST(goalsRequest({ month: 7, year: 2026, targetCents: 500.5 }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/representatives/[id]/goals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns targetAmount in cents, matching what the admin UI must divide by 100 to display', async () => {
    jest.mocked(prisma.repGoal.findMany).mockResolvedValue([
      {
        id: 'goal1',
        targetCents: 50000,
        achievedCents: 12000,
        month: 7,
        year: 2026,
        createdAt: new Date('2026-07-01'),
        updatedAt: new Date('2026-07-01'),
      },
    ] as never);

    const res = await GET(new NextRequest('http://localhost/api/admin/representatives/rep1/goals'), ctx);
    const data = await res.json();
    expect(data.items[0].targetAmount).toBe(50000);
  });
});
