import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { UserDetailPage } from '@/pages/UserDetailPage';

const mockUser = vi.fn();
const mockSupportUser = vi.fn();

vi.mock('@/lib/api', () => ({
  adminApi: { user: (id: string) => mockUser(id) },
  supportApi: { user: (id: string) => mockSupportUser(id) },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ role: 'admin' as const }),
  };
});

describe('UserDetailPage', () => {
  beforeEach(() => {
    mockUser.mockResolvedValue({
      id: 'u1',
      name: 'User',
      email: 'u@x.com',
      plan: 'PRO',
      disabledAt: null,
      onboardingCompletedAt: null,
      createdAt: '',
      leadsUsed: 0,
      leadsLimit: 100,
      companyName: null,
      productService: null,
      targetAudience: null,
      mainBenefit: null,
      updatedAt: '',
      workspaces: [],
      _count: { workspaces: 1, analyses: 0, searchHistory: 0 },
    });
  });

  it('loads and shows user detail when admin', async () => {
    render(
      <MemoryRouter initialEntries={['/users/u1']}>
        <Routes>
          <Route path="/users/:id" element={<UserDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText('u@x.com', {}, { timeout: 3000 });
    expect(mockUser).toHaveBeenCalledWith('u1');
  });
});
