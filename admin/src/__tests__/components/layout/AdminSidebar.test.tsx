import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminSidebar } from '@/components/layout/AdminSidebar';

describe('AdminSidebar', () => {
  it('renders title and brand', () => {
    render(
      <MemoryRouter>
        <AdminSidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Painel Admin')).toBeInTheDocument();
    expect(screen.getByText('Prospector.AI')).toBeInTheDocument();
  });

  it('renders nav sections', () => {
    render(
      <MemoryRouter>
        <AdminSidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });
});
