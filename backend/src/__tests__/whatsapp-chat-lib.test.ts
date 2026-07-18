const mockConvoFindFirst = jest.fn();
const mockConvoCreate = jest.fn();
const mockConvoUpdate = jest.fn();
const mockConvoUpdateMany = jest.fn();
const mockMessageCreate = jest.fn();
const mockMessageUpdateMany = jest.fn();
const mockRepClientFindMany = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    whatsAppConversation: {
      findFirst: mockConvoFindFirst,
      create: mockConvoCreate,
      update: mockConvoUpdate,
      updateMany: mockConvoUpdateMany,
    },
    whatsAppMessage: {
      create: mockMessageCreate,
      updateMany: mockMessageUpdateMany,
    },
    repClient: {
      findMany: mockRepClientFindMany,
    },
    $transaction: mockTransaction,
  },
}));

const {
  recordIncomingMessage,
  recordOutgoingMessage,
  updateMessageStatusByProviderId,
  markConversationRead,
} = require('@/lib/whatsapp-chat');

describe('whatsapp-chat lib', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  });

  describe('recordIncomingMessage', () => {
    it('creates a new conversation matched to an existing RepClient by phone suffix', async () => {
      mockConvoFindFirst.mockResolvedValue(null);
      mockRepClientFindMany.mockResolvedValue([{ id: 'client1', phone: '+55 11 99999-9999' }]);
      mockConvoCreate.mockResolvedValue({ id: 'convo1', unreadCount: 0 });
      mockMessageCreate.mockResolvedValue({ id: 'msg1' });
      mockConvoUpdate.mockResolvedValue({});

      await recordIncomingMessage({
        owner: { representativeId: 'rep1' },
        contactNumber: '5511999999999',
        contactName: 'Alice',
        provider: 'EVOLUTION',
        body: 'oi',
      });

      expect(mockConvoCreate).toHaveBeenCalledWith({
        data: { representativeId: 'rep1', contactNumber: '5511999999999', contactName: 'Alice', repClientId: 'client1' },
        select: { id: true, unreadCount: true },
      });
      expect(mockMessageCreate).toHaveBeenCalledWith({
        data: {
          conversationId: 'convo1',
          direction: 'IN',
          provider: 'EVOLUTION',
          providerMessageId: undefined,
          body: 'oi',
          status: 'DELIVERED',
        },
      });
      expect(mockConvoUpdate).toHaveBeenCalledWith({
        where: { id: 'convo1' },
        data: expect.objectContaining({ lastMessagePreview: 'oi', unreadCount: { increment: 1 } }),
      });
    });

    it('reuses an existing conversation and increments unread count', async () => {
      mockConvoFindFirst.mockResolvedValue({ id: 'convo1', unreadCount: 3, contactName: 'Alice' });
      mockMessageCreate.mockResolvedValue({ id: 'msg1' });
      mockConvoUpdate.mockResolvedValue({});

      await recordIncomingMessage({
        owner: { representativeId: 'rep1' },
        contactNumber: '5511999999999',
        contactName: 'Alice',
        provider: 'META',
        providerMessageId: 'wamid.1',
        body: 'oi de novo',
      });

      expect(mockConvoCreate).not.toHaveBeenCalled();
      expect(mockRepClientFindMany).not.toHaveBeenCalled();
    });

    it('truncates a very long message body in the conversation preview', async () => {
      mockConvoFindFirst.mockResolvedValue({ id: 'convo1', unreadCount: 0, contactName: null });
      mockMessageCreate.mockResolvedValue({ id: 'msg1' });
      mockConvoUpdate.mockResolvedValue({});

      const longBody = 'a'.repeat(200);
      await recordIncomingMessage({
        owner: { adminConfigId: 'admin1' },
        contactNumber: '5511999999999',
        contactName: null,
        provider: 'META',
        body: longBody,
      });

      const updateCall = mockConvoUpdate.mock.calls[0][0];
      expect(updateCall.data.lastMessagePreview.length).toBe(141); // 140 chars + ellipsis
      expect(updateCall.data.lastMessagePreview.endsWith('…')).toBe(true);
    });

    it('does not try to match a RepClient for an admin-owned conversation', async () => {
      mockConvoFindFirst.mockResolvedValue(null);
      mockConvoCreate.mockResolvedValue({ id: 'convo1', unreadCount: 0 });
      mockMessageCreate.mockResolvedValue({ id: 'msg1' });
      mockConvoUpdate.mockResolvedValue({});

      await recordIncomingMessage({
        owner: { adminConfigId: 'admin1' },
        contactNumber: '5511999999999',
        contactName: null,
        provider: 'META',
        body: 'oi',
      });

      expect(mockRepClientFindMany).not.toHaveBeenCalled();
      expect(mockConvoCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ adminConfigId: 'admin1', repClientId: null }) }),
      );
    });
  });

  describe('recordOutgoingMessage', () => {
    it('creates the message and updates the conversation preview without touching unreadCount', async () => {
      mockConvoFindFirst.mockResolvedValue({ id: 'convo1', unreadCount: 2 });
      mockMessageCreate.mockResolvedValue({ id: 'msg1' });
      mockConvoUpdate.mockResolvedValue({});

      const result = await recordOutgoingMessage({
        owner: { representativeId: 'rep1' },
        contactNumber: '5511999999999',
        provider: 'EVOLUTION',
        body: 'oi cliente',
      });

      expect(result).toEqual({ conversationId: 'convo1', messageId: 'msg1' });
      expect(mockConvoUpdate).toHaveBeenCalledWith({
        where: { id: 'convo1' },
        data: { lastMessageAt: expect.any(Date), lastMessagePreview: 'oi cliente' },
      });
    });
  });

  describe('updateMessageStatusByProviderId', () => {
    it('updates status by provider + providerMessageId', async () => {
      mockMessageUpdateMany.mockResolvedValue({ count: 1 });
      await updateMessageStatusByProviderId('META', 'wamid.1', 'READ');
      expect(mockMessageUpdateMany).toHaveBeenCalledWith({
        where: { provider: 'META', providerMessageId: 'wamid.1' },
        data: { status: 'READ' },
      });
    });
  });

  describe('markConversationRead', () => {
    it('returns true when a conversation owned by the caller was updated', async () => {
      mockConvoUpdateMany.mockResolvedValue({ count: 1 });
      const result = await markConversationRead('convo1', { representativeId: 'rep1' });
      expect(result).toBe(true);
      expect(mockConvoUpdateMany).toHaveBeenCalledWith({
        where: { id: 'convo1', representativeId: 'rep1' },
        data: { unreadCount: 0 },
      });
    });

    it('returns false when the conversation does not belong to the caller (cross-rep isolation)', async () => {
      mockConvoUpdateMany.mockResolvedValue({ count: 0 });
      const result = await markConversationRead('convo1', { representativeId: 'rep-other' });
      expect(result).toBe(false);
    });
  });
});
