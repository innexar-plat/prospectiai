import { POST as connectPost } from '@/app/api/admin/whatsapp/connect/route';
import { POST as metaConnectPost } from '@/app/api/admin/whatsapp/meta/connect/route';
import { GET as statusGet } from '@/app/api/admin/whatsapp/status/route';
import { POST as disconnectPost } from '@/app/api/admin/whatsapp/disconnect/route';
import { GET as conversationsGet } from '@/app/api/admin/whatsapp/chat/conversations/route';
import { POST as sendPost } from '@/app/api/admin/whatsapp/chat/send/route';
import { auth } from '@/auth';
import { isAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { isMetaWhatsAppConfigured } from '@/lib/whatsapp-meta';
import { sendChatMessage } from '@/lib/whatsapp-send';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    adminWhatsAppConfig: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    representative: { findUnique: jest.fn() },
    whatsAppConversation: { findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('@/lib/evolution', () => ({
  ensureInstance: jest.fn(),
  getQrCode: jest.fn(),
  getInstanceStatus: jest.fn(),
  logoutInstance: jest.fn(),
}));
jest.mock('@/lib/whatsapp-meta', () => ({ isMetaWhatsAppConfigured: jest.fn() }));
jest.mock('@/lib/whatsapp-send', () => ({ sendChatMessage: jest.fn() }));

const postReq = (payload: Record<string, unknown>) =>
  new NextRequest(new Request('http://localhost', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }));

const baseConfig = {
  id: 'admin1', label: 'Precision IA', provider: 'EVOLUTION', evolutionInstanceName: null,
  whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null, metaPhoneNumberId: null,
};

describe('Admin WhatsApp API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'admin-user' }, expires: '' });
    jest.mocked(isAdmin).mockReturnValue(true);
    jest.mocked(isMetaWhatsAppConfigured).mockReturnValue(true);
    prisma.adminWhatsAppConfig.findFirst.mockResolvedValue(baseConfig);
  });

  it('rejects non-admin sessions across all routes', async () => {
    jest.mocked(isAdmin).mockReturnValue(false);
    expect((await connectPost()).status).toBe(403);
    expect((await statusGet()).status).toBe(403);
    expect((await disconnectPost()).status).toBe(403);
  });

  describe('POST /admin/whatsapp/connect', () => {
    it('creates the instance (auto-creating the singleton config on first use)', async () => {
      prisma.adminWhatsAppConfig.findFirst.mockResolvedValue(null);
      prisma.adminWhatsAppConfig.create.mockResolvedValue(baseConfig);
      const { ensureInstance, getQrCode } = require('@/lib/evolution');
      getQrCode.mockResolvedValue('base64-qr');

      const res = await connectPost();
      expect(res.status).toBe(200);
      expect(prisma.adminWhatsAppConfig.create).toHaveBeenCalledWith({ data: {} });
      expect(ensureInstance).toHaveBeenCalledWith('admin_admin1');
    });
  });

  describe('POST /admin/whatsapp/meta/connect', () => {
    it('returns 409 when the phone number already belongs to a representative', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123' }));
      expect(res.status).toBe(409);
    });

    it('registers the number for the admin config', async () => {
      prisma.representative.findUnique.mockResolvedValue(null);
      const res = await metaConnectPost(postReq({ phoneNumberId: 'phone123', phoneNumber: '5511999999999' }));
      expect(res.status).toBe(200);
      expect(prisma.adminWhatsAppConfig.update).toHaveBeenCalledWith({
        where: { id: 'admin1' },
        data: {
          provider: 'META',
          metaPhoneNumberId: 'phone123',
          whatsappNumber: '5511999999999',
          whatsappStatus: 'CONNECTED',
          whatsappConnectedAt: expect.any(Date),
        },
      });
    });
  });

  describe('GET /admin/whatsapp/status', () => {
    it('reports META status without polling Evolution', async () => {
      prisma.adminWhatsAppConfig.findFirst.mockResolvedValue({ ...baseConfig, provider: 'META', metaPhoneNumberId: 'phone123', whatsappStatus: 'CONNECTED', whatsappNumber: '5511999999999' });
      const { getInstanceStatus } = require('@/lib/evolution');
      const res = await statusGet();
      const body = await res.json();
      expect(body).toEqual({ status: 'CONNECTED', number: '5511999999999', provider: 'META' });
      expect(getInstanceStatus).not.toHaveBeenCalled();
    });
  });

  describe('POST /admin/whatsapp/disconnect', () => {
    it('clears the Meta phone number without calling Evolution', async () => {
      prisma.adminWhatsAppConfig.findFirst.mockResolvedValue({ ...baseConfig, provider: 'META', metaPhoneNumberId: 'phone123' });
      const { logoutInstance } = require('@/lib/evolution');
      const res = await disconnectPost();
      expect(res.status).toBe(200);
      expect(logoutInstance).not.toHaveBeenCalled();
      expect(prisma.adminWhatsAppConfig.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ metaPhoneNumberId: null }),
      }));
    });
  });

  describe('GET /admin/whatsapp/chat/conversations', () => {
    it('scopes the query to this admin config', async () => {
      prisma.whatsAppConversation.findMany.mockResolvedValue([]);
      prisma.whatsAppConversation.count.mockResolvedValue(0);
      const res = await conversationsGet(new NextRequest('http://localhost/x'));
      expect(res.status).toBe(200);
      expect(prisma.whatsAppConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { adminConfigId: 'admin1' },
      }));
    });
  });

  describe('POST /admin/whatsapp/chat/send', () => {
    it('sends using the admin config as the chat owner', async () => {
      jest.mocked(sendChatMessage).mockResolvedValue({ ok: true, conversationId: 'convo1', messageId: 'msg1' });
      const res = await sendPost(postReq({ contactNumber: '11999999999', message: 'oi' }));
      expect(res.status).toBe(200);
      expect(sendChatMessage).toHaveBeenCalledWith(expect.anything(), { adminConfigId: 'admin1' }, '11999999999', 'oi');
    });
  });
});
