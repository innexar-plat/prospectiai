const mockSendEvolutionText = jest.fn();
const mockSendMetaText = jest.fn();
const mockRecordOutgoingMessage = jest.fn();

jest.mock('@/lib/evolution', () => ({ sendText: mockSendEvolutionText }));
jest.mock('@/lib/whatsapp-meta', () => ({ sendMetaText: mockSendMetaText }));
jest.mock('@/lib/whatsapp-chat', () => ({ recordOutgoingMessage: mockRecordOutgoingMessage }));

const { sendChatMessage } = require('@/lib/whatsapp-send');

describe('sendChatMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when the owner is not connected', async () => {
    const result = await sendChatMessage(
      { provider: 'EVOLUTION', evolutionInstanceName: 'rep_1', metaPhoneNumberId: null, whatsappStatus: 'DISCONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi',
    );
    expect(result).toEqual({ ok: false, error: 'WhatsApp not connected' });
    expect(mockSendEvolutionText).not.toHaveBeenCalled();
  });

  it('sends via Evolution and records the outgoing message', async () => {
    mockSendEvolutionText.mockResolvedValue(undefined);
    mockRecordOutgoingMessage.mockResolvedValue({ conversationId: 'convo1', messageId: 'msg1' });

    const result = await sendChatMessage(
      { provider: 'EVOLUTION', evolutionInstanceName: 'rep_1', metaPhoneNumberId: null, whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi',
    );

    expect(result).toEqual({ ok: true, conversationId: 'convo1', messageId: 'msg1' });
    expect(mockSendEvolutionText).toHaveBeenCalledWith('rep_1', '5511999999999', 'oi');
    expect(mockRecordOutgoingMessage).toHaveBeenCalledWith({
      owner: { representativeId: 'rep1' },
      contactNumber: '5511999999999',
      provider: 'EVOLUTION',
      body: 'oi',
    });
  });

  it('returns an error when Evolution is not configured for this owner', async () => {
    const result = await sendChatMessage(
      { provider: 'EVOLUTION', evolutionInstanceName: null, metaPhoneNumberId: null, whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi',
    );
    expect(result).toEqual({ ok: false, error: 'Evolution instance not configured' });
  });

  it('surfaces an Evolution send failure without recording a message', async () => {
    mockSendEvolutionText.mockRejectedValue(new Error('Evolution message/sendText failed: HTTP 500'));
    const result = await sendChatMessage(
      { provider: 'EVOLUTION', evolutionInstanceName: 'rep_1', metaPhoneNumberId: null, whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi',
    );
    expect(result).toEqual({ ok: false, error: 'Evolution message/sendText failed: HTTP 500' });
    expect(mockRecordOutgoingMessage).not.toHaveBeenCalled();
  });

  it('sends via Meta and records the outgoing message with the provider message id', async () => {
    mockSendMetaText.mockResolvedValue({ ok: true, providerMessageId: 'wamid.1' });
    mockRecordOutgoingMessage.mockResolvedValue({ conversationId: 'convo2', messageId: 'msg2' });

    const result = await sendChatMessage(
      { provider: 'META', evolutionInstanceName: null, metaPhoneNumberId: 'phone123', whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi meta',
    );

    expect(result).toEqual({ ok: true, conversationId: 'convo2', messageId: 'msg2' });
    expect(mockSendMetaText).toHaveBeenCalledWith('phone123', '5511999999999', 'oi meta');
    expect(mockRecordOutgoingMessage).toHaveBeenCalledWith({
      owner: { representativeId: 'rep1' },
      contactNumber: '5511999999999',
      provider: 'META',
      providerMessageId: 'wamid.1',
      body: 'oi meta',
    });
  });

  it('surfaces a Meta 24h-window error without recording a message', async () => {
    mockSendMetaText.mockResolvedValue({ ok: false, error: 'Re-engagement message', outsideWindow: true });
    const result = await sendChatMessage(
      { provider: 'META', evolutionInstanceName: null, metaPhoneNumberId: 'phone123', whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi meta',
    );
    expect(result).toEqual({ ok: false, error: 'Re-engagement message', outsideWindow: true });
    expect(mockRecordOutgoingMessage).not.toHaveBeenCalled();
  });

  it('returns an error when Meta phone number is not configured for this owner', async () => {
    const result = await sendChatMessage(
      { provider: 'META', evolutionInstanceName: null, metaPhoneNumberId: null, whatsappStatus: 'CONNECTED' },
      { representativeId: 'rep1' },
      '5511999999999',
      'oi',
    );
    expect(result).toEqual({ ok: false, error: 'Meta phone number not configured' });
  });
});
