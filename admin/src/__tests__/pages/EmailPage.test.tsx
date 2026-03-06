import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmailPage } from '@/pages/EmailPage';

const mockStatus = vi.fn();
const mockGetConfig = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    email: {
      status: () => mockStatus(),
      getConfig: () => mockGetConfig(),
    },
  },
}));

describe('EmailPage', () => {
  beforeEach(() => {
    mockStatus.mockResolvedValue({ configured: false });
    mockGetConfig.mockResolvedValue({
      provider: 'resend',
      fromEmail: '',
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
    });
  });

  it('loads and shows email config section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<EmailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /email/i }, { timeout: 3000 });
    expect(mockStatus).toHaveBeenCalled();
    expect(mockGetConfig).toHaveBeenCalled();
  });
});
