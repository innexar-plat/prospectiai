import { GET as getClients, POST as postClient } from '@/app/api/representative/clients/route';
import { PATCH as patchClient, DELETE as deleteClient } from '@/app/api/representative/clients/[id]/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn() },
    repClient: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockReq = (url = 'http://localhost') => new NextRequest(new Request(url));
const postReq = (payload: Record<string, unknown>) =>
  new NextRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
const patchReq = (payload: Record<string, unknown>) =>
  new NextRequest(new Request('http://localhost', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Representative clients API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/representative/clients', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await getClients(mockReq());
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/representative/clients', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await postClient(postReq({ name: 'Ana' }));
      expect(res.status).toBe(401);
    });

    it('returns 404 when session user is not a representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue(null);
      const res = await postClient(postReq({ name: 'Ana' }));
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid payload', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      const res = await postClient(postReq({ name: '' }));
      expect(res.status).toBe(400);
    });

    it('creates a client scoped to the session representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.create.mockResolvedValue({
        id: 'c1', name: 'Ana', email: null, phone: null, company: null, planId: null,
        status: 'LEAD', valueCents: null, signedAt: null, notes: null, createdAt: new Date('2025-01-01'),
      });

      const res = await postClient(postReq({ name: 'Ana' }));
      expect(res.status).toBe(201);
      expect(prisma.repClient.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ representativeId: 'rep1', name: 'Ana', status: 'LEAD' }),
      }));
    });
  });

  describe('PATCH /api/representative/clients/[id]', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await patchClient(patchReq({ status: 'ACTIVE' }), params('c1'));
      expect(res.status).toBe(401);
    });

    it('returns 403 when the client belongs to a different representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep-other', status: 'LEAD' });

      const res = await patchClient(patchReq({ status: 'ACTIVE' }), params('c1'));
      expect(res.status).toBe(403);
      expect(prisma.repClient.update).not.toHaveBeenCalled();
    });

    it('returns 404 when the client does not exist', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.findUnique.mockResolvedValue(null);

      const res = await patchClient(patchReq({ status: 'ACTIVE' }), params('missing'));
      expect(res.status).toBe(404);
    });

    it('sets signedAt when moving into ACTIVE for the first time', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep1', status: 'LEAD', signedAt: null, canceledAt: null });
      prisma.repClient.update.mockResolvedValue({
        id: 'c1', name: 'Ana', email: null, phone: null, company: null, planId: null,
        status: 'ACTIVE', valueCents: null, signedAt: new Date(), notes: null, createdAt: new Date('2025-01-01'),
      });

      const res = await patchClient(patchReq({ status: 'ACTIVE' }), params('c1'));
      expect(res.status).toBe(200);
      expect(prisma.repClient.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({ status: 'ACTIVE', signedAt: expect.any(Date) }),
      }));
    });

    it('does not overwrite signedAt/canceledAt when already set', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      const existingSignedAt = new Date('2025-02-01');
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep1', status: 'ACTIVE', signedAt: existingSignedAt, canceledAt: null });
      prisma.repClient.update.mockResolvedValue({
        id: 'c1', name: 'Ana', email: null, phone: null, company: null, planId: null,
        status: 'CONVERTED', valueCents: null, signedAt: existingSignedAt, notes: null, createdAt: new Date('2025-01-01'),
      });

      await patchClient(patchReq({ status: 'CONVERTED' }), params('c1'));
      const args = prisma.repClient.update.mock.calls[0][0];
      expect(args.data.signedAt).toBeUndefined();
    });
  });

  describe('DELETE /api/representative/clients/[id]', () => {
    it('returns 403 when the client belongs to a different representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep-other' });

      const res = await deleteClient(mockReq(), params('c1'));
      expect(res.status).toBe(403);
      expect(prisma.repClient.delete).not.toHaveBeenCalled();
    });

    it('deletes the client when owned by the session representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep1' });
      prisma.repClient.delete.mockResolvedValue({ id: 'c1' });

      const res = await deleteClient(mockReq(), params('c1'));
      expect(res.status).toBe(200);
      expect(prisma.repClient.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });
});
