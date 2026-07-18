import { GET } from '@/app/api/admin/representatives/[id]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/admin';
import { getRepDashboard, getRepBalance } from '@/lib/representative';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { representative: { findUnique: jest.fn() } },
}));
jest.mock('@/lib/representative', () => ({
  ...jest.requireActual('@/lib/representative'),
  getRepDashboard: jest.fn(),
  getRepBalance: jest.fn(),
}));

const baseRep = {
  id: 'cmrdf7r8m00pamc01qswo1bdj',
  name: 'Franciney Costa',
  email: 'franciney@x.com',
  document: null,
  phone: '67998835803',
  region: 'Centro oeste',
  level: 'SILVER',
  status: 'ACTIVE',
  creditLimit: 200,
  directCommissionPct: 20,
  affiliateOverridePct: 5,
  commissionHoldDays: 30,
  payoutType: null,
  payoutPayload: null,
  minPayoutCents: 10000,
  monthlyGoalCents: null,
  notes: null,
  createdAt: new Date('2026-07-09'),
  updatedAt: new Date('2026-07-09'),
  lastActivityAt: null,
  user: { id: 'u1', email: 'franciney@x.com', name: 'Franciney Costa' },
  workspaceId: 'w1',
  workspace: { id: 'w1', plan: 'FREE', subscriptionStatus: 'inactive', leadsLimit: 200, market: 'BR' },
  _count: { clients: 0, commissions: 0, affiliates: 0 },
};

describe('GET /api/admin/representatives/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin1', email: 'admin@x.com' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);
    jest.mocked(getRepDashboard).mockResolvedValue(null);
    jest.mocked(getRepBalance).mockResolvedValue({ availableCents: 0 } as never);
  });

  it('builds a BR disclosure link for a BR representative, regardless of the admin request host', async () => {
    jest.mocked(prisma.representative.findUnique).mockResolvedValue(baseRep as never);

    // Admin is browsing from the US domain, but the rep is BR-market.
    const req = new NextRequest('https://precisionai.innexar.app/api/admin/representatives/rep1', {
      headers: { host: 'precisionai.innexar.app' },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'rep1' }) });
    const data = await res.json();

    expect(data.currency).toBe('BRL');
    expect(data.disclosureLink).toContain('precisionia.com.br');
    expect(data.disclosureLink).not.toContain('innexar.app');
    expect(data.disclosureLink).toContain(`?rep=${baseRep.id}`);
  });

  it('builds a US disclosure link for a US representative', async () => {
    jest.mocked(prisma.representative.findUnique).mockResolvedValue({
      ...baseRep,
      workspace: { ...baseRep.workspace, market: 'US' },
    } as never);

    const req = new NextRequest('https://precisionia.com.br/api/admin/representatives/rep1', {
      headers: { host: 'precisionia.com.br' },
    });
    const res = await GET(req, { params: Promise.resolve({ id: 'rep1' }) });
    const data = await res.json();

    expect(data.currency).toBe('USD');
    expect(data.disclosureLink).toContain('innexar.app');
    expect(data.disclosureLink).not.toContain('precisionia.com.br');
  });
});
