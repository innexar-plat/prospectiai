import { createHmac } from 'crypto';

const mockFetchWithRetry = jest.fn();

jest.mock('@/lib/fetch-http', () => ({ fetchWithRetry: mockFetchWithRetry }));

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

describe('whatsapp-meta lib', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      META_WHATSAPP_ACCESS_TOKEN: 'token123',
      META_WHATSAPP_APP_SECRET: 'app-secret',
      META_WHATSAPP_VERIFY_TOKEN: 'verify-token',
    };
  });
  afterAll(() => { process.env = OLD_ENV; });

  describe('isMetaWhatsAppConfigured', () => {
    it('is configured when both token and app secret are set', () => {
      const { isMetaWhatsAppConfigured } = require('@/lib/whatsapp-meta');
      expect(isMetaWhatsAppConfigured()).toBe(true);
    });

    it('is not configured when the access token is missing', () => {
      process.env.META_WHATSAPP_ACCESS_TOKEN = '';
      const { isMetaWhatsAppConfigured } = require('@/lib/whatsapp-meta');
      expect(isMetaWhatsAppConfigured()).toBe(false);
    });
  });

  describe('sendMetaText', () => {
    it('returns the provider message id on success', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { messages: [{ id: 'wamid.ABC' }] }));
      const { sendMetaText } = require('@/lib/whatsapp-meta');
      const result = await sendMetaText('phone123', '5511999999999', 'oi');
      expect(result).toEqual({ ok: true, providerMessageId: 'wamid.ABC' });
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/phone123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer token123' }),
        }),
        expect.any(Object),
      );
    });

    it('flags a 24h-window error distinctly (code 131047)', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(400, { error: { code: 131047, message: 'Re-engagement message' } }));
      const { sendMetaText } = require('@/lib/whatsapp-meta');
      const result = await sendMetaText('phone123', '5511999999999', 'oi');
      expect(result).toEqual({ ok: false, error: 'Re-engagement message', outsideWindow: true });
    });

    it('returns a generic error for other failures', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(500, { error: { code: 1, message: 'Internal error' } }));
      const { sendMetaText } = require('@/lib/whatsapp-meta');
      const result = await sendMetaText('phone123', '5511999999999', 'oi');
      expect(result).toEqual({ ok: false, error: 'Internal error', outsideWindow: false });
    });

    it('returns not-configured error without calling fetch when env is missing', async () => {
      process.env.META_WHATSAPP_ACCESS_TOKEN = '';
      const { sendMetaText } = require('@/lib/whatsapp-meta');
      const result = await sendMetaText('phone123', '5511999999999', 'oi');
      expect(result.ok).toBe(false);
      expect(mockFetchWithRetry).not.toHaveBeenCalled();
    });
  });

  describe('sendMetaTemplate', () => {
    it('sends a template with body params', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { messages: [{ id: 'wamid.TPL' }] }));
      const { sendMetaTemplate } = require('@/lib/whatsapp-meta');
      const result = await sendMetaTemplate('phone123', '5511999999999', 'welcome', 'pt_BR', ['Alice']);
      expect(result).toEqual({ ok: true, providerMessageId: 'wamid.TPL' });
      const [, init] = mockFetchWithRetry.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.template).toEqual({
        name: 'welcome',
        language: { code: 'pt_BR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Alice' }] }],
      });
    });
  });

  describe('verifyMetaWebhookChallenge', () => {
    it('accepts a matching subscribe token', () => {
      const { verifyMetaWebhookChallenge } = require('@/lib/whatsapp-meta');
      expect(verifyMetaWebhookChallenge('subscribe', 'verify-token')).toBe(true);
    });

    it('rejects a wrong token', () => {
      const { verifyMetaWebhookChallenge } = require('@/lib/whatsapp-meta');
      expect(verifyMetaWebhookChallenge('subscribe', 'wrong')).toBe(false);
    });

    it('rejects a non-subscribe mode', () => {
      const { verifyMetaWebhookChallenge } = require('@/lib/whatsapp-meta');
      expect(verifyMetaWebhookChallenge('unsubscribe', 'verify-token')).toBe(false);
    });
  });

  describe('verifyMetaWebhookSignature', () => {
    it('accepts a correctly signed body', () => {
      const { verifyMetaWebhookSignature } = require('@/lib/whatsapp-meta');
      const rawBody = '{"a":1}';
      const sig = createHmac('sha256', 'app-secret').update(rawBody).digest('hex');
      expect(verifyMetaWebhookSignature(rawBody, `sha256=${sig}`)).toBe(true);
    });

    it('rejects a tampered body', () => {
      const { verifyMetaWebhookSignature } = require('@/lib/whatsapp-meta');
      const sig = createHmac('sha256', 'app-secret').update('{"a":1}').digest('hex');
      expect(verifyMetaWebhookSignature('{"a":2}', `sha256=${sig}`)).toBe(false);
    });

    it('rejects a missing signature header', () => {
      const { verifyMetaWebhookSignature } = require('@/lib/whatsapp-meta');
      expect(verifyMetaWebhookSignature('{"a":1}', null)).toBe(false);
    });
  });

  describe('parseMetaWebhookPayload', () => {
    it('parses an incoming text message with contact name', () => {
      const { parseMetaWebhookPayload } = require('@/lib/whatsapp-meta');
      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone123' },
              contacts: [{ wa_id: '5511999999999', profile: { name: 'Alice' } }],
              messages: [{ from: '5511999999999', id: 'wamid.IN1', timestamp: '123', type: 'text', text: { body: 'oi' } }],
            },
          }],
        }],
      };
      const { messages, statuses } = parseMetaWebhookPayload(payload);
      expect(messages).toEqual([{
        phoneNumberId: 'phone123',
        from: '5511999999999',
        contactName: 'Alice',
        providerMessageId: 'wamid.IN1',
        body: 'oi',
        timestamp: '123',
      }]);
      expect(statuses).toEqual([]);
    });

    it('parses a status update', () => {
      const { parseMetaWebhookPayload } = require('@/lib/whatsapp-meta');
      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone123' },
              statuses: [{ id: 'wamid.OUT1', status: 'delivered' }],
            },
          }],
        }],
      };
      const { messages, statuses } = parseMetaWebhookPayload(payload);
      expect(messages).toEqual([]);
      expect(statuses).toEqual([{ phoneNumberId: 'phone123', providerMessageId: 'wamid.OUT1', status: 'delivered' }]);
    });

    it('ignores non-text message types and unknown statuses', () => {
      const { parseMetaWebhookPayload } = require('@/lib/whatsapp-meta');
      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone123' },
              messages: [{ from: '5511999999999', id: 'wamid.IMG', type: 'image' }],
              statuses: [{ id: 'wamid.X', status: 'deleted' }],
            },
          }],
        }],
      };
      const { messages, statuses } = parseMetaWebhookPayload(payload);
      expect(messages).toEqual([]);
      expect(statuses).toEqual([]);
    });

    it('returns empty arrays for an empty payload', () => {
      const { parseMetaWebhookPayload } = require('@/lib/whatsapp-meta');
      expect(parseMetaWebhookPayload({})).toEqual({ messages: [], statuses: [] });
    });
  });
});
