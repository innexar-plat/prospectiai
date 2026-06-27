import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AiConfigPage } from '@/pages/AiConfigPage';

const mockAiConfigList = vi.fn();
const mockWebSearchList = vi.fn();
const mockAiRuntimeGet = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    aiConfig: { list: () => mockAiConfigList() },
    webSearchConfig: { list: () => mockWebSearchList() },
    aiRuntime: { get: () => mockAiRuntimeGet() },
  },
}));

describe('AiConfigPage', () => {
  beforeEach(() => {
    mockAiConfigList.mockResolvedValue({ items: [] });
    mockWebSearchList.mockResolvedValue({ items: [] });
    mockAiRuntimeGet.mockResolvedValue({
      controls: {
        analyzeRateLimitMax: 10,
        analyzeRateLimitWindowSeconds: 60,
        analyzeBulkheadMaxInFlight: 5,
        analyzeBulkheadAcquireTimeoutMs: 500,
        aiModelMaxInFlight: 5,
        analyzeAiMaxOutputTokens: 4096,
        aiCircuitBreakerFailureThreshold: 3,
        aiCircuitBreakerOpenMs: 30000,
        aiFallbackProvider: 'GEMINI',
        aiCloudflareModelsLeadAnalysis: '',
        aiCloudflareModelsViability: '',
        aiCloudflareModelsCompanyAnalysis: '',
      },
    });
  });

  it('loads and shows config section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AiConfigPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /IA \/ Provedores/i }, { timeout: 3000 });
    expect(mockAiConfigList).toHaveBeenCalled();
    expect(mockWebSearchList).toHaveBeenCalled();
    expect(mockAiRuntimeGet).toHaveBeenCalled();
  });
});
