import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';

const mockUser = { id: '1', email: 'a@b.com', name: 'Admin', role: 'admin' as const };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ user: mockUser, role: 'admin' as const }),
  };
});

function LayoutWithContext() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<div>Child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminLayout', () => {
  it('renders header and main area', () => {
    render(<LayoutWithContext />);
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
  });
});
