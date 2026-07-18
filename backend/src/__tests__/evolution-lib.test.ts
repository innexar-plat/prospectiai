const mockFetchWithRetry = jest.fn();

jest.mock('@/lib/fetch-http', () => ({ fetchWithRetry: mockFetchWithRetry }));

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

describe('evolution lib', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, EVOLUTION_API_URL: 'https://evolution.test', EVOLUTION_API_KEY: 'key123' };
  });
  afterAll(() => { process.env = OLD_ENV; });

  describe('isEvolutionConfigured / instanceNameForRep', () => {
    it('is configured when both env vars are set', () => {
      const { isEvolutionConfigured } = require('@/lib/evolution');
      expect(isEvolutionConfigured()).toBe(true);
    });

    it('is not configured when the API key is missing', () => {
      process.env.EVOLUTION_API_KEY = '';
      const { isEvolutionConfigured } = require('@/lib/evolution');
      expect(isEvolutionConfigured()).toBe(false);
    });

    it('builds a namespaced instance name', () => {
      const { instanceNameForRep } = require('@/lib/evolution');
      expect(instanceNameForRep('abc123')).toBe('rep_abc123');
    });
  });

  describe('getQrCode', () => {
    it('reads a top-level base64 field', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { base64: 'AAA' }));
      const { getQrCode } = require('@/lib/evolution');
      expect(await getQrCode('rep_1')).toBe('AAA');
    });

    it('falls back to nested qrcode.base64', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { qrcode: { base64: 'BBB' } }));
      const { getQrCode } = require('@/lib/evolution');
      expect(await getQrCode('rep_1')).toBe('BBB');
    });

    it('throws on a non-ok response', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(500, {}));
      const { getQrCode } = require('@/lib/evolution');
      await expect(getQrCode('rep_1')).rejects.toThrow('HTTP 500');
    });
  });

  describe('getInstanceStatus', () => {
    it('maps open/connecting through and defaults unknown states to close', async () => {
      const { getInstanceStatus } = require('@/lib/evolution');

      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { instance: { state: 'open' } }));
      expect(await getInstanceStatus('rep_1')).toBe('open');

      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { instance: { state: 'connecting' } }));
      expect(await getInstanceStatus('rep_1')).toBe('connecting');

      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { instance: { state: 'weird' } }));
      expect(await getInstanceStatus('rep_1')).toBe('close');
    });

    it('returns close when the request fails', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(503, {}));
      const { getInstanceStatus } = require('@/lib/evolution');
      expect(await getInstanceStatus('rep_1')).toBe('close');
    });
  });

  describe('ensureInstance', () => {
    it('treats 409 (already exists) as success', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(409, {}));
      const { ensureInstance } = require('@/lib/evolution');
      await expect(ensureInstance('rep_1')).resolves.toBeUndefined();
    });

    it('throws on other failures', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(500, {}));
      const { ensureInstance } = require('@/lib/evolution');
      await expect(ensureInstance('rep_1')).rejects.toThrow('HTTP 500');
    });
  });

  describe('sendText', () => {
    it('throws when the send fails', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(400, {}));
      const { sendText } = require('@/lib/evolution');
      await expect(sendText('rep_1', '5511999999999', 'oi')).rejects.toThrow('HTTP 400');
    });

    it('resolves when the send succeeds', async () => {
      mockFetchWithRetry.mockResolvedValue(jsonRes(200, { ok: true }));
      const { sendText } = require('@/lib/evolution');
      await expect(sendText('rep_1', '5511999999999', 'oi')).resolves.toBeUndefined();
    });
  });
});
