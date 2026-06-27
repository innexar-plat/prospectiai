import { GET, PATCH } from '@/app/api/leads/[id]/contact-intelligence/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildContactIntelligenceByLeadId, setPrimaryContact } from '@/lib/contact-intelligence';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/request-id', () => ({
  getOrCreateRequestId: jest.fn(() => 'req-test-1'),
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
  buildContactIntelligenceByLeadId: jest.fn(),
  setPrimaryContact: jest.fn(),
}));

describe('Lead Contact Intelligence route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/leads/l1/contact-intelligence');
    const res = await GET(req as unknown as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: 'l1' }),
    });

    expect(res.status).toBe(401);
  });

  it('GET returns data when lead resolves', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });
    (prisma.lead.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'lead_1' })
      .mockResolvedValueOnce(null);
    (buildContactIntelligenceByLeadId as jest.Mock).mockResolvedValueOnce({
      leadId: 'lead_1',
      placeId: 'rf_123',
      contactsHealthScore: 70,
      recommendedContacts: { phone: null, email: null, website: null },
      alternatives: [],
    });

    const req = new Request('http://localhost/api/leads/lead_1/contact-intelligence');
    const res = await GET(req as unknown as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: 'lead_1' }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('data.leadId', 'lead_1');
  });

  it('PATCH returns 400 when contactId is missing', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });

    const req = new Request('http://localhost/api/leads/l1/contact-intelligence', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: 'l1' }),
    });

    expect(res.status).toBe(400);
  });

  it('PATCH returns 404 when setPrimaryContact cannot find contact', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'u1' } });
    (prisma.lead.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'lead_1' })
      .mockResolvedValueOnce(null);
    (setPrimaryContact as jest.Mock).mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/leads/lead_1/contact-intelligence', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: 'c1' }),
    });

    const res = await PATCH(req as unknown as Parameters<typeof PATCH>[0], {
      params: Promise.resolve({ id: 'lead_1' }),
    });

    expect(res.status).toBe(404);
  });
});
