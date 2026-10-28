import { POST } from '@/app/api/admin/ai-config/[id]/test/route';

const mockGenerateText = jest.fn();
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/admin', () => ({ isAdmin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAction: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/ai', () => ({ createLanguageModel: jest.fn(() => ({ modelId: 'mock-model' })) }));
jest.mock('@/lib/ai/encrypt', () => ({ decryptApiKey: jest.fn(() => 'decrypted-key') }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiProviderConfig: {
      findUnique: jest.fn(),
    },
  },
}));

const auth = require('@/auth').auth;
const isAdmin = require('@/lib/admin').isAdmin;
const prisma = require('@/lib/prisma').prisma;
const { createLanguageModel } = require('@/lib/ai');

describe('POST /api/admin/ai-config/[id]/test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'admin-1' } });
    isAdmin.mockReturnValue(true);
    prisma.aiProviderConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      provider: 'DEEPSEEK',
      model: 'deepseek-flash',
      apiKeyEncrypted: 'encrypted-key',
      cloudflareAccountId: null,
    });
  });

  it('tests the saved provider config and rejects an empty completion', async () => {
    mockGenerateText.mockResolvedValue({ text: '' });

    const response = await POST(
      new Request('http://localhost/api/admin/ai-config/config-1/test', { method: 'POST' }),
      { params: Promise.resolve({ id: 'config-1' }) },
    );

    expect(createLanguageModel).toHaveBeenCalledWith({
      provider: 'DEEPSEEK',
      model: 'deepseek-flash',
      apiKey: 'decrypted-key',
      accountId: undefined,
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Test failed',
      details: 'Provider returned an empty response',
    });
  });

  it('reports success when the saved provider returns text', async () => {
    mockGenerateText.mockResolvedValue({ text: 'OK' });

    const response = await POST(
      new Request('http://localhost/api/admin/ai-config/config-1/test', { method: 'POST' }),
      { params: Promise.resolve({ id: 'config-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
