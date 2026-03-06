import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminGuard } from '@/components/AdminGuard';

const mockSession = vi.fn();

vi.mock('@/lib/api', () => ({
  authApi: { session: () => mockSession() },
}));

describe('AdminGuard', () => {
  beforeEach(() => {
    mockSession.mockReset();
  });

  it('shows loading initially', () => {
    mockSession.mockImplementation(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows forbidden when user role is not admin or support', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: '1', email: 'u@x.com', role: null },
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/acesso negado/i)).toBeInTheDocument();
    });
  });

  it('renders outlet when user is admin', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: '1', email: 'a@b.com', name: 'Admin', role: 'admin' },
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route index element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('renders outlet when user is support', async () => {
    mockSession.mockResolvedValueOnce({
      user: { id: '2', email: 's@b.com', role: 'support' },
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AdminGuard />}>
            <Route index element={<div>Support view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Support view')).toBeInTheDocument();
    });
  });
});
