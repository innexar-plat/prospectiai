import { PATCH } from '@/app/api/leads/[id]/contact-intelligence/primary/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { setPrimaryContact } from '@/lib/contact-intelligence';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: jest.fn(() => 'req-test-primary-1'),
  jsonWithRequestId: jest.fn((data, init) => {
    const status = init?.status ?? 200;
    const res = Response.json(data, { status });
    res.headers.set('x-request-id', init.requestId);
    return res;
  }),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn() },
}));
jest.mock('@/lib/contact-intelligence', () => ({
  setPrimaryContact: jest.fn(),
}));

describe('Lead Contact Intelligence primary route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/leads/l1/contact-intelligence/primary', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: 'c1' }),
    });

    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: 'l1' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 400 when contactId is missing', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1', email: 'u1@test.com' } });

    const req = new Request('http://localhost/api/leads/l1/contact-intelligence/primary', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: 'l1' }),
    });

    expect(res.status).toBe(400);
  });

  it('calls setPrimaryContact with audit context and reason', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1', email: 'u1@test.com' } });
    (prisma.lead.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'lead_1' })
      .mockResolvedValueOnce(null);
    (setPrimaryContact as jest.Mock).mockResolvedValueOnce({
      leadId: 'lead_1',
      placeId: 'ChIJ_1',
      contactsHealthScore: 80,
      riskFlags: [],
      recommendedContacts: { phone: null, email: null, website: null },
      alternatives: [],
    });

    const req = new Request('http://localhost/api/leads/lead_1/contact-intelligence/primary', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: 'c1', reason: 'melhor canal' }),
    });

    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: 'lead_1' }),
    });

    expect(res.status).toBe(200);
    expect(setPrimaryContact).toHaveBeenCalledWith('lead_1', 'c1', {
      actorUserId: 'u1',
      actorEmail: 'u1@test.com',
      reason: 'melhor canal',
    });
  });
});
