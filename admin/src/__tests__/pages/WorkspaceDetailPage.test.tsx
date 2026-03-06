import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WorkspaceDetailPage } from '@/pages/WorkspaceDetailPage';

const mockWorkspace = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: {
    workspace: (id: string) => mockWorkspace(id),
  },
}));

describe('WorkspaceDetailPage', () => {
  beforeEach(() => {
    mockWorkspace.mockResolvedValue({
      id: 'w1',
      name: 'WS1',
      plan: 'PRO',
      leadsUsed: 0,
      leadsLimit: 400,
      createdAt: '',
      updatedAt: '',
      _count: { members: 1, analyses: 0, searchHistory: 0 },
      members: [],
    });
  });

  it('shows ID não informado when no id', () => {
    render(
      <MemoryRouter initialEntries={['/workspaces']}>
        <Routes>
          <Route path="/workspaces" element={<WorkspaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/ID não informado/i)).toBeInTheDocument();
  });

  it('loads and shows workspace when id present', async () => {
    render(
      <MemoryRouter initialEntries={['/workspaces/w1']}>
        <Routes>
          <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('WS1', {}, { timeout: 3000 });
    expect(mockWorkspace).toHaveBeenCalledWith('w1');
  });
});
