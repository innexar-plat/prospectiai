import { createHmac } from 'crypto';
import { GET, POST } from '@/app/api/webhooks/whatsapp/meta/route';
import { prisma } from '@/lib/prisma';
import { recordIncomingMessage, updateMessageStatusByProviderId } from '@/lib/whatsapp-chat';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn() },
    adminWhatsAppConfig: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/webhook-dedup', () => ({ isWebhookDuplicate: jest.fn(() => Promise.resolve(false)) }));
jest.mock('@/lib/whatsapp-chat', () => ({
  recordIncomingMessage: jest.fn(),
  updateMessageStatusByProviderId: jest.fn(),
}));

const APP_SECRET = 'app-secret';

function signedPostReq(bodyObj: unknown) {
  const rawBody = JSON.stringify(bodyObj);
  const sig = createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  return new NextRequest(new Request('http://localhost/webhooks/whatsapp/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': `sha256=${sig}` },
    body: rawBody,
  }));
}

describe('WhatsApp Meta webhook', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, META_WHATSAPP_APP_SECRET: APP_SECRET, META_WHATSAPP_VERIFY_TOKEN: 'verify-token' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  describe('GET (verification handshake)', () => {
    it('echoes the challenge when the token matches', async () => {
      const req = new NextRequest('http://localhost/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=verify-token&hub.challenge=CHALLENGE123');
      const res = await GET(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('CHALLENGE123');
    });

    it('rejects a wrong token', async () => {
      const req = new NextRequest('http://localhost/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=CHALLENGE123');
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST (incoming events)', () => {
    it('rejects a payload with an invalid signature', async () => {
      const rawBody = JSON.stringify({ entry: [] });
      const req = new NextRequest(new Request('http://localhost/webhooks/whatsapp/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=wrong' },
        body: rawBody,
      }));
      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(recordIncomingMessage).not.toHaveBeenCalled();
    });

    it('routes an incoming message to the owning representative', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });

      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone123' },
              contacts: [{ wa_id: '5511999999999', profile: { name: 'Alice' } }],
              messages: [{ from: '5511999999999', id: 'wamid.1', type: 'text', text: { body: 'oi' }, timestamp: '123' }],
            },
          }],
        }],
      };
      const res = await POST(signedPostReq(payload));
      expect(res.status).toBe(200);
      expect(recordIncomingMessage).toHaveBeenCalledWith({
        owner: { representativeId: 'rep1' },
        contactNumber: '5511999999999',
        contactName: 'Alice',
        provider: 'META',
        providerMessageId: 'wamid.1',
        body: 'oi',
      });
    });

    it('routes an incoming message to the admin config when no representative owns the number', async () => {
      prisma.representative.findUnique.mockResolvedValue(null);
      prisma.adminWhatsAppConfig.findUnique.mockResolvedValue({ id: 'admin1' });

      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone-admin' },
              messages: [{ from: '5511999999999', id: 'wamid.2', type: 'text', text: { body: 'suporte' } }],
            },
          }],
        }],
      };
      const res = await POST(signedPostReq(payload));
      expect(res.status).toBe(200);
      expect(recordIncomingMessage).toHaveBeenCalledWith(expect.objectContaining({ owner: { adminConfigId: 'admin1' } }));
    });

    it('ignores a message for an unknown phone_number_id', async () => {
      prisma.representative.findUnique.mockResolvedValue(null);
      prisma.adminWhatsAppConfig.findUnique.mockResolvedValue(null);

      const payload = {
        entry: [{ changes: [{ value: { metadata: { phone_number_id: 'unknown' }, messages: [{ from: 'x', id: 'y', type: 'text', text: { body: 'z' } }] } }] }],
      };
      const res = await POST(signedPostReq(payload));
      expect(res.status).toBe(200);
      expect(recordIncomingMessage).not.toHaveBeenCalled();
    });

    it('updates message status for a delivery receipt', async () => {
      const payload = {
        entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone123' }, statuses: [{ id: 'wamid.1', status: 'delivered' }] } }] }],
      };
      const res = await POST(signedPostReq(payload));
      expect(res.status).toBe(200);
      expect(updateMessageStatusByProviderId).toHaveBeenCalledWith('META', 'wamid.1', 'DELIVERED');
    });
  });
});
