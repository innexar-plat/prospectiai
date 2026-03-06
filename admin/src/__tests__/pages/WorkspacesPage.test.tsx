import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WorkspacesPage } from '@/pages/WorkspacesPage';

const mockWorkspaces = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { workspaces: (...args: unknown[]) => mockWorkspaces(...args) },
}));

describe('WorkspacesPage', () => {
  beforeEach(() => {
    mockWorkspaces.mockReset();
  });

  it('shows loading then list when adminApi.workspaces resolves', async () => {
    mockWorkspaces.mockResolvedValue({
      items: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<WorkspacesPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Workspaces')).toBeInTheDocument();
    await screen.findByText('Nenhum workspace encontrado.', {}, { timeout: 3000 });
  });

  it('shows error when adminApi.workspaces rejects', async () => {
    mockWorkspaces.mockRejectedValue(new Error('Failed'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<WorkspacesPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Failed', {}, { timeout: 3000 });
  });
});
