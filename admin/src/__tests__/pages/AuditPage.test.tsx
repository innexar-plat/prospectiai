import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuditPage } from '@/pages/AuditPage';

const mockAuditLogs = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { auditLogs: (...args: unknown[]) => mockAuditLogs(...args) },
}));

describe('AuditPage', () => {
  beforeEach(() => {
    mockAuditLogs.mockReset();
  });

  it('shows loading then content when adminApi.auditLogs resolves', async () => {
    mockAuditLogs.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AuditPage />} />
        </Routes>
      </MemoryRouter>
    );
    const table = await screen.findByRole('table', {}, { timeout: 3000 });
    expect(table).toBeInTheDocument();
    expect(screen.getByText(/Log de auditoria/i)).toBeInTheDocument();
  });

  it('shows error when adminApi.auditLogs rejects', async () => {
    mockAuditLogs.mockRejectedValue(new Error('Server error'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AuditPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Server error', {}, { timeout: 3000 });
  });
});
