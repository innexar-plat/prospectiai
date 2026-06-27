import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmailLogsPage } from '@/pages/EmailLogsPage';

const mockEmailLogs = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    emailLogs: (...args: unknown[]) => mockEmailLogs(...args),
  },
}));

describe('EmailLogsPage', () => {
  beforeEach(() => {
    mockEmailLogs.mockResolvedValue({ items: [], total: 0 });
  });

  it('loads and shows email logs section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<EmailLogsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/logs de email/i, {}, { timeout: 3000 });
    expect(mockEmailLogs).toHaveBeenCalled();
  });

  it('shows error banner when fetch fails', async () => {
    mockEmailLogs.mockRejectedValue(new Error('Falha na API'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<EmailLogsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText(/falha na api/i)).toBeInTheDocument();
  });
});
