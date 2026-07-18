import { GET as conversationsGet } from '@/app/api/representative/whatsapp/chat/conversations/route';
import { GET as messagesGet } from '@/app/api/representative/whatsapp/chat/conversations/[id]/messages/route';
import { POST as readPost } from '@/app/api/representative/whatsapp/chat/conversations/[id]/read/route';
import { POST as sendPost } from '@/app/api/representative/whatsapp/chat/send/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { markConversationRead } from '@/lib/whatsapp-chat';
import { sendChatMessage } from '@/lib/whatsapp-send';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    representative: { findUnique: jest.fn() },
    whatsAppConversation: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    whatsAppMessage: { findMany: jest.fn(), count: jest.fn() },
  },
}));
jest.mock('@/lib/whatsapp-chat', () => ({ markConversationRead: jest.fn() }));
jest.mock('@/lib/whatsapp-send', () => ({ sendChatMessage: jest.fn() }));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Representative WhatsApp chat API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(auth).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
  });

  describe('GET /chat/conversations', () => {
    it('returns 401 when unauthenticated', async () => {
      jest.mocked(auth).mockResolvedValue(null);
      const res = await conversationsGet(new NextRequest('http://localhost/chat/conversations'));
      expect(res.status).toBe(401);
    });

    it('lists conversations for the session rep, most recent first', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.whatsAppConversation.findMany.mockResolvedValue([
        {
          id: 'convo1', contactNumber: '5511999999999', contactName: 'Alice',
          lastMessageAt: new Date('2026-07-09T10:00:00Z'), lastMessagePreview: 'oi', unreadCount: 2,
          repClientId: 'client1', repClient: { id: 'client1', name: 'Alice Corp', company: 'Corp' },
          createdAt: new Date('2026-07-01'),
        },
      ]);
      prisma.whatsAppConversation.count.mockResolvedValue(1);

      const res = await conversationsGet(new NextRequest('http://localhost/chat/conversations'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toEqual([{
        id: 'convo1',
        contactNumber: '5511999999999',
        contactName: 'Alice',
        lastMessageAt: '2026-07-09T10:00:00.000Z',
        lastMessagePreview: 'oi',
        unreadCount: 2,
        repClientId: 'client1',
        repClientName: 'Alice Corp',
        repClientCompany: 'Corp',
        createdAt: '2026-07-01T00:00:00.000Z',
      }]);
      expect(prisma.whatsAppConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { representativeId: 'rep1' },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      }));
    });
  });

  describe('GET /chat/conversations/[id]/messages', () => {
    it('returns 403 when the conversation belongs to a different representative', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.whatsAppConversation.findUnique.mockResolvedValue({ representativeId: 'rep-other' });
      const res = await messagesGet(new NextRequest('http://localhost/x'), ctx('convo1'));
      expect(res.status).toBe(403);
    });

    it('returns messages in chronological order (oldest first)', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      prisma.whatsAppConversation.findUnique.mockResolvedValue({ representativeId: 'rep1' });
      prisma.whatsAppMessage.findMany.mockResolvedValue([
        { id: 'm2', direction: 'OUT', body: 'segunda', status: 'SENT', createdAt: new Date('2026-07-09T10:01:00Z') },
        { id: 'm1', direction: 'IN', body: 'primeira', status: 'DELIVERED', createdAt: new Date('2026-07-09T10:00:00Z') },
      ]);
      prisma.whatsAppMessage.count.mockResolvedValue(2);

      const res = await messagesGet(new NextRequest('http://localhost/x'), ctx('convo1'));
      const body = await res.json();
      expect(body.items.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('POST /chat/conversations/[id]/read', () => {
    it('returns 404 when the conversation is not owned by this rep', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      jest.mocked(markConversationRead).mockResolvedValue(false);
      const res = await readPost(new Request('http://localhost'), ctx('convo1'));
      expect(res.status).toBe(404);
    });

    it('marks the conversation read', async () => {
      prisma.representative.findUnique.mockResolvedValue({ id: 'rep1' });
      jest.mocked(markConversationRead).mockResolvedValue(true);
      const res = await readPost(new Request('http://localhost'), ctx('convo1'));
      expect(res.status).toBe(200);
      expect(markConversationRead).toHaveBeenCalledWith('convo1', { representativeId: 'rep1' });
    });
  });

  describe('POST /chat/send', () => {
    const postReq = (payload: Record<string, unknown>) =>
      new NextRequest(new Request('http://localhost', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }));

    it('normalizes the contact number before sending', async () => {
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappProvider: 'EVOLUTION', evolutionInstanceName: 'rep_1', metaPhoneNumberId: null, whatsappStatus: 'CONNECTED',
      });
      jest.mocked(sendChatMessage).mockResolvedValue({ ok: true, conversationId: 'convo1', messageId: 'msg1' });

      const res = await sendPost(postReq({ contactNumber: '(11) 99999-9999', message: 'oi' }));
      expect(res.status).toBe(200);
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.anything(),
        { representativeId: 'rep1' },
        '11999999999',
        'oi',
      );
    });

    it('returns 409 when not connected', async () => {
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappProvider: 'EVOLUTION', evolutionInstanceName: null, metaPhoneNumberId: null, whatsappStatus: 'DISCONNECTED',
      });
      jest.mocked(sendChatMessage).mockResolvedValue({ ok: false, error: 'WhatsApp not connected' });

      const res = await sendPost(postReq({ contactNumber: '11999999999', message: 'oi' }));
      expect(res.status).toBe(409);
    });

    it('returns 502 with outsideWindow flag for a Meta 24h-window failure', async () => {
      prisma.representative.findUnique.mockResolvedValue({
        id: 'rep1', whatsappProvider: 'META', evolutionInstanceName: null, metaPhoneNumberId: 'phone1', whatsappStatus: 'CONNECTED',
      });
      jest.mocked(sendChatMessage).mockResolvedValue({ ok: false, error: 'Re-engagement message', outsideWindow: true });

      const res = await sendPost(postReq({ contactNumber: '11999999999', message: 'oi' }));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.outsideWindow).toBe(true);
    });
  });
});
