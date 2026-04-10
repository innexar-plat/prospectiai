/**
 * Tests for AI resolve (by-role resolution).
 */
import { resolveAiForRole, createLanguageModel } from '@/lib/ai';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiProviderConfig: { findFirst: jest.fn() },
  },
}));

// Mock AI SDK providers to avoid real API calls
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn(() => ({ modelId: 'gemini-mock' }))),
}));

const { prisma } = require('@/lib/prisma');

describe('AI resolve', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    jest.clearAllMocks();
  });

  it('falls back to GEMINI_API_KEY when no DB config', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    prisma.aiProviderConfig.findFirst.mockRejectedValue(new Error('no table'));

    const { config, model } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('GEMINI');
    expect(config.model).toBe('gemini-2.5-flash');
    expect(config.apiKey).toBe('env-key');
    expect(model).toBeDefined();
  });

  it('throws when no DB config and no GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    prisma.aiProviderConfig.findFirst.mockResolvedValue(null);

    await expect(resolveAiForRole('viability')).rejects.toThrow(/No AI config/);
  });

  it('createLanguageModel throws for unknown provider', () => {
    expect(() => createLanguageModel({
      provider: 'UNKNOWN' as 'GEMINI',
      model: 'test',
      apiKey: 'key',
    })).toThrow(/Unknown AI provider/);
  });

  it('createLanguageModel throws for CLOUDFLARE without accountId', () => {
    expect(() => createLanguageModel({
      provider: 'CLOUDFLARE',
      model: 'test',
      apiKey: 'key',
    })).toThrow(/requires accountId/);
  });
});
