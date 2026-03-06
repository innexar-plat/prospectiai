import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LeadsPage } from '@/pages/LeadsPage';

const mockLeads = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { leads: (...args: unknown[]) => mockLeads(...args) },
}));

describe('LeadsPage', () => {
  beforeEach(() => {
    mockLeads.mockReset();
  });

  it('shows loading then content when adminApi.leads resolves', async () => {
    mockLeads.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LeadsPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Leads')).toBeInTheDocument();
    await screen.findByText(/Nenhum lead encontrado/i, {}, { timeout: 3000 });
  });

  it('shows error when adminApi.leads rejects', async () => {
    mockLeads.mockRejectedValue(new Error('API error'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<LeadsPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('API error', {}, { timeout: 3000 });
  });
});
