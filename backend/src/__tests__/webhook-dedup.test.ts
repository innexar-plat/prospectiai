import { isWebhookDuplicate } from '@/lib/webhook-dedup';

// Mock Redis
const mockSet = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: mockSet,
    connect: mockConnect,
    on: mockOn,
  }));
});

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

describe('webhook-dedup', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('returns false for new events (SET NX returns OK)', async () => {
    mockSet.mockResolvedValue('OK');
    const result = await isWebhookDuplicate('stripe', 'evt_123');
    expect(result).toBe(false);
    expect(mockSet).toHaveBeenCalledWith('webhook:dedup:stripe:evt_123', '1', 'EX', 86400, 'NX');
  });

  it('returns true for duplicate events (SET NX returns null)', async () => {
    mockSet.mockResolvedValue(null);
    const result = await isWebhookDuplicate('stripe', 'evt_123');
    expect(result).toBe(true);
  });

  it('returns false (fail-open) when Redis throws', async () => {
    mockSet.mockRejectedValue(new Error('Connection refused'));
    const result = await isWebhookDuplicate('mercadopago', 'pay_456');
    expect(result).toBe(false);
  });

  it('uses provider in key to isolate namespaces', async () => {
    mockSet.mockResolvedValue('OK');
    await isWebhookDuplicate('mercadopago', 'pay_789');
    expect(mockSet).toHaveBeenCalledWith('webhook:dedup:mercadopago:pay_789', '1', 'EX', 86400, 'NX');
  });
});
