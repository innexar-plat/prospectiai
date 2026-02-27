import { GET } from '@/app/api/export/leads/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    leadAnalysis: { findMany: jest.fn() },
  },
}));

describe('GET /api/export/leads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    auth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/export/leads');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 200 with JSON when format=json or default', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      workspaces: [{ workspaceId: 'w1' }],
    } as never);
    const analyses = [{ id: 'a1', leadId: 'l1', score: 8, lead: { name: 'Lead 1' } }];
    prisma.leadAnalysis.findMany.mockResolvedValue(analyses as never);

    const req = new NextRequest('http://localhost/api/export/leads');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].leadId).toBe('l1');
  });

  it('returns 400 when format is invalid', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const req = new NextRequest('http://localhost/api/export/leads?format=xml');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with CSV when format=csv', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      workspaces: [{ workspaceId: 'w1' }],
    } as never);
    prisma.leadAnalysis.findMany.mockResolvedValue([
      {
        leadId: 'l1',
        lead: { name: 'Business' },
        score: 8,
        scoreLabel: 'Quente',
        status: 'NEW',
        summary: 'Ok',
        createdAt: new Date('2025-01-01'),
      },
    ] as never);

    const req = new NextRequest('http://localhost/api/export/leads?format=csv');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('leadId,leadName,score');
    expect(text).toContain('l1,"Business",8');
  });
});
