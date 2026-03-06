import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useOutletContext } from 'react-router-dom';
import { AdminOnlyRoute } from '@/components/AdminOnlyRoute';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: vi.fn(),
  };
});

const mockUseOutletContext = vi.mocked(useOutletContext);

describe('AdminOnlyRoute', () => {
  it('renders outlet when role is admin', () => {
    mockUseOutletContext.mockReturnValue({ user: {}, role: 'admin' });
    render(
      <MemoryRouter initialEntries={['/d']}>
        <Routes>
          <Route path="/" element={<AdminOnlyRoute />}>
            <Route path="d" element={<div>Admin content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('redirects to users when role is support', () => {
    mockUseOutletContext.mockReturnValue({ user: {}, role: 'support' });
    render(
      <MemoryRouter initialEntries={['/d']}>
        <Routes>
          <Route path="/" element={<AdminOnlyRoute />}>
            <Route path="d" element={<div>Admin content</div>} />
          </Route>
          <Route path="users" element={<div>Users</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Users')).toBeInTheDocument();
  });
});
