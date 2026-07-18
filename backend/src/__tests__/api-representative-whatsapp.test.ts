import { POST as connectPost } from '@/app/api/representative/whatsapp/connect/route';
import { GET as statusGet } from '@/app/api/representative/whatsapp/status/route';
import { POST as disconnectPost } from '@/app/api/representative/whatsapp/disconnect/route';
import { POST as sendPost } from '@/app/api/representative/whatsapp/send/route';
import { POST as webhookPost } from '@/app/api/representative/whatsapp/webhook/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn(), update: jest.fn() },
    repClient: { findUnique: jest.fn() },
    adminWhatsAppConfig: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('@/lib/evolution', () => ({
  ...jest.requireActual('@/lib/evolution'),
  ensureInstance: jest.fn(),
  getQrCode: jest.fn(),
  getInstanceStatus: jest.fn(),
  logoutInstance: jest.fn(),
  sendText: jest.fn(),
  instanceNameForRep: (id: string) => `rep_${id}`,
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/webhook-dedup', () => ({ isWebhookDuplicate: jest.fn(() => Promise.resolve(false)) }));
jest.mock('@/lib/whatsapp-chat', () => ({ recordIncomingMessage: jest.fn() }));
jest.mock('@/lib/whatsapp-send', () => ({ sendChatMessage: jest.fn() }));

const mockReq = (url = 'http://localhost') => new NextRequest(new Request(url));
const postReq = (payload: Record<string, unknown>, url = 'http://localhost') =>
  new NextRequest(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));

describe('Representative WhatsApp API', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, EVOLUTION_WEBHOOK_TOKEN: 'secret-token' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  describe('POST /representative/whatsapp/connect', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await connectPost();
      expect(res.status).toBe(401);
    });

    it('returns 404 when session user is not a representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue(null);
      const res = await connectPost();
      expect(res.status).toBe(404);
    });

    it('creates the instance and returns a QR code', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', evolutionInstanceName: null });
      const { ensureInstance, getQrCode } = require('@/lib/evolution');
      ensureInstance.mockResolvedValue(undefined);
      getQrCode.mockResolvedValue('base64-qr');

      const res = await connectPost();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.qrCode).toBe('base64-qr');
      expect(ensureInstance).toHaveBeenCalledWith('rep_rep1');
      expect(prisma.representative.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'rep1' },
        data: { evolutionInstanceName: 'rep_rep1', whatsappStatus: 'CONNECTING' },
      }));
    });
  });

  describe('GET /representative/whatsapp/status', () => {
    it('returns DISCONNECTED without calling Evolution when no instance is set', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', evolutionInstanceName: null, whatsappStatus: 'DISCONNECTED', whatsappNumber: null });
      const { getInstanceStatus } = require('@/lib/evolution');

      const res = await statusGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('DISCONNECTED');
      expect(getInstanceStatus).not.toHaveBeenCalled();
    });

    it('promotes to CONNECTED when Evolution reports the instance is open', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', evolutionInstanceName: 'rep_rep1', whatsappStatus: 'CONNECTING', whatsappNumber: null });
      const { getInstanceStatus } = require('@/lib/evolution');
      getInstanceStatus.mockResolvedValue('open');

      const res = await statusGet();
      const body = await res.json();
      expect(body.status).toBe('CONNECTED');
      expect(prisma.representative.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ whatsappStatus: 'CONNECTED' }),
      }));
    });

    it('reports META status directly without polling Evolution', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappProvider: 'META', metaPhoneNumberId: 'phone123', whatsappStatus: 'CONNECTED', whatsappNumber: '5511999999999',
      });
      const { getInstanceStatus } = require('@/lib/evolution');

      const res = await statusGet();
      const body = await res.json();
      expect(body).toEqual({ status: 'CONNECTED', number: '5511999999999', provider: 'META' });
      expect(getInstanceStatus).not.toHaveBeenCalled();
    });

    it('reports META as DISCONNECTED when no phone number is registered yet', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappProvider: 'META', metaPhoneNumberId: null, whatsappStatus: 'CONNECTED', whatsappNumber: null,
      });

      const res = await statusGet();
      const body = await res.json();
      expect(body.status).toBe('DISCONNECTED');
    });
  });

  describe('POST /representative/whatsapp/disconnect', () => {
    it('logs out the instance and resets fields', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', evolutionInstanceName: 'rep_rep1' });
      const { logoutInstance } = require('@/lib/evolution');

      const res = await disconnectPost();
      expect(res.status).toBe(200);
      expect(logoutInstance).toHaveBeenCalledWith('rep_rep1');
      expect(prisma.representative.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null },
      }));
    });

    it('clears the Meta phone number instead of calling Evolution when provider is META', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', whatsappProvider: 'META', metaPhoneNumberId: 'phone123' });
      const { logoutInstance } = require('@/lib/evolution');

      const res = await disconnectPost();
      expect(res.status).toBe(200);
      expect(logoutInstance).not.toHaveBeenCalled();
      expect(prisma.representative.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { whatsappStatus: 'DISCONNECTED', whatsappNumber: null, whatsappConnectedAt: null, metaPhoneNumberId: null },
      }));
    });
  });

  describe('POST /representative/whatsapp/send', () => {
    it('returns 409 when the representative is not connected', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', whatsappStatus: 'DISCONNECTED', evolutionInstanceName: null });

      const res = await sendPost(postReq({ repClientId: 'c1', message: 'oi' }));
      expect(res.status).toBe(409);
    });

    it('returns 403 when the client belongs to a different representative', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', whatsappStatus: 'CONNECTED', evolutionInstanceName: 'rep_rep1' });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep-other', phone: '11999999999' });
      const { sendChatMessage } = require('@/lib/whatsapp-send');

      const res = await sendPost(postReq({ repClientId: 'c1', message: 'oi' }));
      expect(res.status).toBe(403);
      expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it('sends the message when connected and the client belongs to the rep', async () => {
      jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappStatus: 'CONNECTED', evolutionInstanceName: 'rep_rep1', whatsappProvider: 'EVOLUTION', metaPhoneNumberId: null,
      });
      prisma.repClient.findUnique.mockResolvedValue({ id: 'c1', representativeId: 'rep1', phone: '(11) 99999-9999' });
      const { sendChatMessage } = require('@/lib/whatsapp-send');
      sendChatMessage.mockResolvedValue({ ok: true, conversationId: 'convo1', messageId: 'msg1' });

      const res = await sendPost(postReq({ repClientId: 'c1', message: 'oi' }));
      expect(res.status).toBe(200);
      expect(sendChatMessage).toHaveBeenCalledWith(
        { provider: 'EVOLUTION', evolutionInstanceName: 'rep_rep1', metaPhoneNumberId: null, whatsappStatus: 'CONNECTED' },
        { representativeId: 'rep1' },
        '11999999999',
        'oi',
      );
    });
  });

  describe('POST /representative/whatsapp/webhook', () => {
    it('returns 401 for an invalid token', async () => {
      const res = await webhookPost(postReq({ event: 'CONNECTION_UPDATE' }, 'http://localhost/webhook?token=wrong'));
      expect(res.status).toBe(401);
    });

    it('updates the representative to CONNECTED on an open state event', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1', whatsappNumber: null });
      const res = await webhookPost(postReq(
        { event: 'CONNECTION_UPDATE', instance: 'rep_rep1', data: { state: 'open', number: '5511999999999' } },
        'http://localhost/webhook?token=secret-token',
      ));
      expect(res.status).toBe(200);
      expect(prisma.representative.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'rep1' },
        data: expect.objectContaining({ whatsappStatus: 'CONNECTED', whatsappNumber: '5511999999999' }),
      }));
    });

    it('skips duplicate deliveries of the same payload', async () => {
      const { isWebhookDuplicate } = require('@/lib/webhook-dedup');
      isWebhookDuplicate.mockResolvedValue(true);
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });

      const res = await webhookPost(postReq(
        { event: 'CONNECTION_UPDATE', instance: 'rep_rep1', data: { state: 'open' } },
        'http://localhost/webhook?token=secret-token',
      ));
      expect(res.status).toBe(200);
      expect(prisma.representative.update).not.toHaveBeenCalled();
    });

    it('ignores events for unknown instances without throwing', async () => {
      prisma.representative.findUnique.mockResolvedValue(null);
      const res = await webhookPost(postReq(
        { event: 'CONNECTION_UPDATE', instance: 'rep_unknown', data: { state: 'open' } },
        'http://localhost/webhook?token=secret-token',
      ));
      expect(res.status).toBe(200);
      expect(prisma.representative.update).not.toHaveBeenCalled();
    });

    it('records an incoming text message (regression: webhook used to only handle connection state, never messages)', async () => {
      const { recordIncomingMessage } = require('@/lib/whatsapp-chat');
      const { isWebhookDuplicate } = require('@/lib/webhook-dedup');
      isWebhookDuplicate.mockResolvedValue(false);
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });

      const res = await webhookPost(postReq(
        {
          instance: 'rep_rep1',
          data: {
            key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG1' },
            pushName: 'Alice',
            message: { conversation: 'oi, tudo bem?' },
          },
        },
        'http://localhost/webhook?token=secret-token',
      ));

      expect(res.status).toBe(200);
      expect(recordIncomingMessage).toHaveBeenCalledWith({
        owner: { representativeId: 'rep1' },
        contactNumber: '5511999999999',
        contactName: 'Alice',
        provider: 'EVOLUTION',
        providerMessageId: 'MSG1',
        body: 'oi, tudo bem?',
      });
    });

    it('routes to the AdminWhatsAppConfig when no representative owns the instance', async () => {
      const { recordIncomingMessage } = require('@/lib/whatsapp-chat');
      const { isWebhookDuplicate } = require('@/lib/webhook-dedup');
      isWebhookDuplicate.mockResolvedValue(false);
      prisma.representative.findUnique.mockResolvedValue(null);
      prisma.adminWhatsAppConfig.findUnique.mockResolvedValue({ id: 'admin1' });

      const res = await webhookPost(postReq(
        {
          instance: 'admin_admin1',
          data: {
            key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG3' },
            message: { conversation: 'oi suporte' },
          },
        },
        'http://localhost/webhook?token=secret-token',
      ));

      expect(res.status).toBe(200);
      expect(recordIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ owner: { adminConfigId: 'admin1' } }));
    });

    it('does not record an echo of our own outgoing message (fromMe: true)', async () => {
      const { recordIncomingMessage } = require('@/lib/whatsapp-chat');
      const { isWebhookDuplicate } = require('@/lib/webhook-dedup');
      isWebhookDuplicate.mockResolvedValue(false);
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });

      const res = await webhookPost(postReq(
        {
          instance: 'rep_rep1',
          data: {
            key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, id: 'MSG2' },
            message: { conversation: 'mensagem que eu mandei' },
          },
        },
        'http://localhost/webhook?token=secret-token',
      ));

      expect(res.status).toBe(200);
      expect(recordIncomingMessage).not.toHaveBeenCalled();
    });
  });
});
