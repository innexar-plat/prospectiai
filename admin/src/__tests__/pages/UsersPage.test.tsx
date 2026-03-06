import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UsersPage } from '@/pages/UsersPage';

const mockUsers = vi.fn();
const mockSupportUsers = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { users: (...args: unknown[]) => mockUsers(...args) },
  supportApi: { users: (...args: unknown[]) => mockSupportUsers(...args) },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ user: {}, role: 'admin' as const }),
  };
});

describe('UsersPage', () => {
  beforeEach(() => {
    mockUsers.mockReset();
    mockSupportUsers.mockReset();
  });

  it('shows loading then list when adminApi.users resolves', async () => {
    mockUsers.mockResolvedValue({
      items: [{ id: 'u1', name: 'U1', email: 'u1@x.com', plan: 'PRO', disabledAt: null, onboardingCompletedAt: null, createdAt: '', _count: { workspaces: 1, analyses: 0, searchHistory: 0 } }],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<UsersPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Usuários')).toBeInTheDocument();
    await screen.findByText('u1@x.com', {}, { timeout: 3000 });
    expect(mockUsers).toHaveBeenCalled();
  });

  it('shows error when adminApi.users rejects', async () => {
    mockUsers.mockRejectedValue(new Error('Network error'));
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<UsersPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('Network error', {}, { timeout: 3000 });
  });
});
