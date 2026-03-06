import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProfilePage } from '@/pages/ProfilePage';

const mockUser = { id: '1', email: 'u@test.com', name: 'User', role: 'admin' as const };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ user: mockUser, role: 'admin' as const }),
  };
});

describe('ProfilePage', () => {
  it('renders profile title and user data', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Meu perfil')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('u@test.com')).toBeInTheDocument();
  });
});
