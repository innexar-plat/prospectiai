import { POST as metaConnectPost } from '@/app/api/representative/whatsapp/meta/connect/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isMetaWhatsAppConfigured } from '@/lib/whatsapp-meta';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/lib/whatsapp-meta', () => ({ isMetaWhatsAppConfigured: jest.fn() }));

const postReq = (payload: Record<string, unknown>) =>
  new NextRequest(new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));

describe('POST /representative/whatsapp/meta/connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isMetaWhatsAppConfigured).mockReturnValue(true);
  });

  it('returns 401 when unauthenticated', async () => {
    jest.mocked(auth).mockResolvedValue(null);
    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
    expect(res.status).toBe(401);
  });

  it('returns 501 when Meta Cloud API is not configured on this server', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    jest.mocked(isMetaWhatsAppConfigured).mockReturnValue(false);
    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
    expect(res.status).toBe(501);
  });

  it('returns 404 when session user is not a representative', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.representative.findUnique.mockResolvedValue(null);
    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
    expect(res.status).toBe(404);
  });

  it('returns 409 when the phone number is already connected to a different representative', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.representative.findUnique
      .mockResolvedValueOnce({ id: 'rep1' })
      .mockResolvedValueOnce({ id: 'rep-other' });
    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
    expect(res.status).toBe(409);
    expect(prisma.representative.update).not.toHaveBeenCalled();
  });

  it('registers the phone number and marks the rep as CONNECTED via META', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.representative.findUnique
      .mockResolvedValueOnce({ id: 'rep1', whatsappNumber: null })
      .mockResolvedValueOnce(null);

    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123', phoneNumber: '5511999999999' }));
    expect(res.status).toBe(200);
    expect(prisma.representative.update).toHaveBeenCalledWith({
      where: { id: 'rep1' },
      data: {
        whatsappProvider: 'META',
        metaPhoneNumberId: 'phone123',
        whatsappNumber: '5511999999999',
        whatsappStatus: 'CONNECTED',
        whatsappConnectedAt: expect.any(Date),
      },
    });
  });

  it('allows re-registering the same phone number for the same representative (idempotent reconnect)', async () => {
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    prisma.representative.findUnique
      .mockResolvedValueOnce({ id: 'rep1', whatsappNumber: '5511999999999' })
      .mockResolvedValueOnce({ id: 'rep1' });

    const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
    expect(res.status).toBe(200);
    expect(prisma.representative.update).toHaveBeenCalled();
  });
});
