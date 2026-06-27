/**
 * Tests for AI resolve (by-role resolution).
 */
import { resolveAiForRole, createLanguageModel, generateCompletionForRole } from '@/lib/ai';
import { resolveAiCandidatesForRole } from '@/lib/ai/resolve';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aiProviderConfig: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/ai/encrypt', () => ({
  decryptApiKey: jest.fn((value: string) => `dec-${value}`),
}));

const mockGenerateText = jest.fn();
const mockGenerateObject = jest.fn();
jest.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));
import { generateObjectForRole } from '@/lib/ai';

// Mock AI SDK providers to avoid real API calls
jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn(() => ({ modelId: 'gemini-mock' }))),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => jest.fn(() => ({ modelId: 'openai-mock' }))),
}));

const { prisma } = require('@/lib/prisma');

describe('AI resolve', () => {
  const originalEnv = process.env.GEMINI_API_KEY;
  const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;
  const originalOpenRouterLeadModels = process.env.AI_OPENROUTER_MODELS_LEAD_ANALYSIS;
  const originalCfApiToken = process.env.CLOUDFLARE_AI_API_TOKEN;
  const originalCfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalCfLeadModels = process.env.AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS;
  const originalIncludeEnvFallback = process.env.AI_ALWAYS_INCLUDE_ENV_FALLBACK;

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    delete process.env.AI_FALLBACK_PROVIDER;
    process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
    process.env.AI_OPENROUTER_MODELS_LEAD_ANALYSIS = originalOpenRouterLeadModels;
    process.env.CLOUDFLARE_AI_API_TOKEN = originalCfApiToken;
    process.env.CLOUDFLARE_ACCOUNT_ID = originalCfAccountId;
    process.env.AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS = originalCfLeadModels;
    process.env.AI_ALWAYS_INCLUDE_ENV_FALLBACK = originalIncludeEnvFallback;
    jest.clearAllMocks();
  });

  it('falls back to GEMINI_API_KEY when no DB config', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    delete process.env.AI_FALLBACK_PROVIDER;
    prisma.aiProviderConfig.findMany.mockRejectedValue(new Error('no table'));

    const { config, model } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('GEMINI');
    expect(config.model).toBe('gemini-2.5-flash');
    expect(config.apiKey).toBe('env-key');
    expect(model).toBeDefined();
  });

  it('throws when no DB config and no GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_AI_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    prisma.aiProviderConfig.findMany.mockResolvedValue([]);

    await expect(resolveAiForRole('viability')).rejects.toThrow(/No AI config/);
  });

  it('uses DB config before env fallback when available', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'OPENAI',
        model: 'gpt-4.1-mini',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: null,
      },
    ]);

    const { config } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('OPENAI');
    expect(config.model).toBe('gpt-4.1-mini');
    expect(config.apiKey).toBe('dec-k1');
  });

  it('does not include env fallback when DB providers exist by default', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    delete process.env.AI_ALWAYS_INCLUDE_ENV_FALLBACK;
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'CLOUDFLARE',
        model: '@cf/openai/gpt-oss-20b',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: 'acc-1',
      },
    ]);

    mockGenerateText.mockResolvedValueOnce({ text: '{"ok":true}', usage: { inputTokens: 1, outputTokens: 1 } });

    const result = await generateCompletionForRole('lead_analysis', { prompt: 'hello', jsonMode: true });
    expect(result.provider).toBe('CLOUDFLARE');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('falls back to GEMINI env when Cloudflare returns 429 and AI_ALWAYS_INCLUDE_ENV_FALLBACK=true', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.CLOUDFLARE_AI_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    process.env.AI_ALWAYS_INCLUDE_ENV_FALLBACK = 'true';
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'CLOUDFLARE',
        model: '@cf/openai/gpt-oss-20b',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: 'acc-1',
      },
    ]);

    const quotaError = new Error('429 quota exceeded');
    mockGenerateText
      .mockRejectedValueOnce(quotaError)
      .mockResolvedValueOnce({ text: '{"ok":true}', usage: { inputTokens: 5, outputTokens: 10 } });

    const result = await generateCompletionForRole('lead_analysis', { prompt: 'hello', jsonMode: true });
    expect(result.provider).toBe('GEMINI');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.text).toBe('{"ok":true}');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it('falls back to second model when first model fails', async () => {
    process.env.GEMINI_API_KEY = 'env-key';
    delete process.env.OPENROUTER_API_KEY;
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'OPENAI',
        model: 'gpt-4.1-mini',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: null,
        updatedAt: new Date('2026-06-01'),
      },
      {
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        apiKeyEncrypted: 'k2',
        cloudflareAccountId: null,
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    mockGenerateText
      .mockRejectedValueOnce(new Error('gemini timeout'))
      .mockResolvedValueOnce({ text: '{"ok":true}', usage: { inputTokens: 10, outputTokens: 20 } });

    const result = await generateCompletionForRole('lead_analysis', { prompt: 'hello' });
    expect(result.text).toBe('{"ok":true}');
    expect(result.provider).toBe('OPENAI');
    expect(result.model).toBe('gpt-4.1-mini');
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
  });

  it('does not force JSON mode for Cloudflare structured output', async () => {
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'CLOUDFLARE',
        model: '@cf/openai/gpt-oss-20b',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: 'acc-1',
      },
    ]);

    mockGenerateObject.mockResolvedValueOnce({
      object: { ok: true },
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await generateObjectForRole('lead_analysis', {
      prompt: 'hello',
      schema: { parse: (value: unknown) => value } as never,
    });

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject.mock.calls[0][0]).toMatchObject({
      mode: undefined,
    });
  });

  it('keeps explicit JSON mode for non-Cloudflare structured output', async () => {
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'OPENAI',
        model: 'gpt-4.1-mini',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: null,
      },
    ]);

    mockGenerateObject.mockResolvedValueOnce({
      object: { ok: true },
      usage: { inputTokens: 1, outputTokens: 1 },
    });

    await generateObjectForRole('lead_analysis', {
      prompt: 'hello',
      schema: { parse: (value: unknown) => value } as never,
    });

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(mockGenerateObject.mock.calls[0][0]).toMatchObject({
      mode: 'json',
    });
  });

  it('uses Cloudflare env fallback model pool when configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.CLOUDFLARE_AI_API_TOKEN = 'cf-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.AI_CLOUDFLARE_MODELS_LEAD_ANALYSIS = '@cf/meta/llama-3.1-8b-instruct,@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    prisma.aiProviderConfig.findMany.mockResolvedValue([]);

    const { config } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('CLOUDFLARE');
    expect(config.model).toBe('@cf/meta/llama-3.1-8b-instruct');
    expect(config.accountId).toBe('acc-1');
    expect(config.apiKey).toBe('cf-token');
  });

  it('uses OpenRouter env fallback model pool when configured', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.CLOUDFLARE_AI_API_TOKEN;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    process.env.OPENROUTER_API_KEY = 'or-token';
    process.env.AI_OPENROUTER_MODELS_LEAD_ANALYSIS = 'liquid/lfm-2.5-1.2b-instruct:free,meta-llama/llama-3.3-70b-instruct:free';
    prisma.aiProviderConfig.findMany.mockResolvedValue([]);

    const { config } = await resolveAiForRole('lead_analysis');
    expect(config.provider).toBe('OPENROUTER');
    expect(config.model).toBe('liquid/lfm-2.5-1.2b-instruct:free');
    expect(config.apiKey).toBe('or-token');
  });

  it('orders env fallback chain CLOUDFLARE → GEMINI → OPENROUTER', async () => {
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.CLOUDFLARE_AI_API_TOKEN = 'cf-key';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1';
    process.env.GEMINI_API_KEY = 'gem-key';
    prisma.aiProviderConfig.findMany.mockResolvedValue([]);

    const candidates = await resolveAiCandidatesForRole('lead_analysis');
    const providers = candidates.map((c) => c.provider);

    expect(providers[0]).toBe('CLOUDFLARE');
    expect(providers).toContain('GEMINI');
    expect(providers[providers.length - 1]).toBe('OPENROUTER');
  });

  it('sorts DB configs by provider priority (CLOUDFLARE before GEMINI before OPENROUTER)', async () => {
    prisma.aiProviderConfig.findMany.mockResolvedValue([
      {
        provider: 'OPENROUTER',
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        apiKeyEncrypted: 'k3',
        cloudflareAccountId: null,
        updatedAt: new Date('2026-06-01'),
      },
      {
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        apiKeyEncrypted: 'k1',
        cloudflareAccountId: null,
        updatedAt: new Date('2026-06-01'),
      },
      {
        provider: 'CLOUDFLARE',
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        apiKeyEncrypted: 'k2',
        cloudflareAccountId: 'acc-1',
        updatedAt: new Date('2026-01-01'),
      },
    ]);

    const candidates = await resolveAiCandidatesForRole('lead_analysis');
    expect(candidates[0].provider).toBe('CLOUDFLARE');
    expect(candidates[1].provider).toBe('GEMINI');
    expect(candidates[2].provider).toBe('OPENROUTER');
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
