import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlansPage } from '@/pages/PlansPage';

const mockList = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    plans: { list: () => mockList() },
  },
}));

describe('PlansPage', () => {
  beforeEach(() => {
    mockList.mockResolvedValue([]);
  });

  it('loads and shows plans section', async () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PlansPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: /Configuração de Planos/i }, { timeout: 3000 });
    expect(mockList).toHaveBeenCalled();
  });

  it('shows error when list rejects', async () => {
    mockList.mockRejectedValue(new Error('Load failed'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<PlansPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Load failed', {}, { timeout: 3000 });
  });
});
