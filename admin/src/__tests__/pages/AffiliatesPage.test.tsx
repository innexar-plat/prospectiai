import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AffiliatesPage } from '@/pages/AffiliatesPage';

const mockAffiliates = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    affiliates: (...args: unknown[]) => mockAffiliates(...args),
  },
}));

describe('AffiliatesPage', () => {
  beforeEach(() => {
    mockAffiliates.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('loads and shows affiliates section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AffiliatesPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/afiliados|novo afiliado/i, {}, { timeout: 3000 });
    expect(mockAffiliates).toHaveBeenCalled();
  });
});
