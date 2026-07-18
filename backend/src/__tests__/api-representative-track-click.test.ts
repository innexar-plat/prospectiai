import { POST } from '@/app/api/representative/track-click/route';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/ratelimit';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: { representative: { updateMany: jest.fn() } },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }));

function clickRequest(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://localhost/api/representative/track-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/representative/track-click', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 29, reset: 0 });
    jest.mocked(prisma.representative.updateMany).mockResolvedValue({ count: 1 } as never);
  });

  it('increments linkClicks for an active rep code', async () => {
    const res = await POST(clickRequest({ code: 'cmrdf7r9z00pemc014590v2z8' }));
    expect(res.status).toBe(200);
    expect(prisma.representative.updateMany).toHaveBeenCalledWith({
      where: { id: 'cmrdf7r9z00pemc014590v2z8', status: 'ACTIVE' },
      data: { linkClicks: { increment: 1 } },
    });
  });

  it('does not throw / still returns ok for an unknown code (matches zero rows silently)', async () => {
    jest.mocked(prisma.representative.updateMany).mockResolvedValue({ count: 0 } as never);
    const res = await POST(clickRequest({ code: 'does-not-exist' }));
    expect(res.status).toBe(200);
  });

  it('rejects an empty/missing code', async () => {
    const res = await POST(clickRequest({}));
    expect(res.status).toBe(400);
    expect(prisma.representative.updateMany).not.toHaveBeenCalled();
  });

  it('rate limits by IP', async () => {
    jest.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, reset: 0 });
    const res = await POST(clickRequest({ code: 'cmrdf7r9z00pemc014590v2z8' }));
    expect(res.status).toBe(429);
    expect(prisma.representative.updateMany).not.toHaveBeenCalled();
  });
});
