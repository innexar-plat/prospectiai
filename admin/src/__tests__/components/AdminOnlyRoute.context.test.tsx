import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useOutletContext, Outlet } from 'react-router-dom';
import { AdminOnlyRoute } from '@/components/AdminOnlyRoute';
import type { AdminLayoutContext } from '@/components/layout/AdminLayout';

describe('AdminOnlyRoute outlet context', () => {
  it('forwards layout context to nested routes', () => {
    const mockUser = { id: '1', email: 'a@test.com', name: 'Admin User', role: 'admin' as const };
    const ctx: AdminLayoutContext = { user: mockUser, role: 'admin' };

    function ContextReader() {
      const { user } = useOutletContext<AdminLayoutContext>();
      return <div>{user.name}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/" element={<Outlet context={ctx} />}>
            <Route element={<AdminOnlyRoute />}>
              <Route path="profile" element={<ContextReader />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });
});
