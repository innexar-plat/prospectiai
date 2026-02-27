/**
 * Tests for AI resolve (by-role resolution).
 */
import { resolveAiForRole } from '@/lib/ai';

const mockAdapter = { generateCompletion: jest.fn().mockResolvedValue('ok') };

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiProviderConfig: { findFirst: jest.fn() },
  },
}));

jest.mock('@/lib/ai/adapters/gemini', () => ({
  createGeminiAdapter: jest.fn(() => mockAdapter),
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

    const { config, adapter } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('GEMINI');
    expect(config.model).toBe('gemini-flash-latest');
    expect(config.apiKey).toBe('env-key');
    expect(adapter).toBeDefined();
  });

  it('throws when no DB config and no GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    prisma.aiProviderConfig.findFirst.mockResolvedValue(null);

    await expect(resolveAiForRole('viability')).rejects.toThrow(/No AI config/);
  });
});
