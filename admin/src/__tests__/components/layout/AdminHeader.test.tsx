import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminHeader } from '@/components/layout/AdminHeader';

describe('AdminHeader', () => {
  const user = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' as const };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders page title from path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminHeader user={user} />
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders user email', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AdminHeader user={user} />
      </MemoryRouter>
    );
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    render(
      <MemoryRouter initialEntries={['/users']}>
        <AdminHeader user={user} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
    expect(screen.getByText('Usuários')).toBeInTheDocument();
  });
});
