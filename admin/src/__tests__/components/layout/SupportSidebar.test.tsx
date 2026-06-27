import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SupportSidebar } from '@/components/layout/SupportSidebar';

describe('SupportSidebar', () => {
  it('renders title and nav', () => {
    render(
      <MemoryRouter>
        <SupportSidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Painel Suporte')).toBeInTheDocument();
    expect(screen.getByText('Usuários')).toBeInTheDocument();
    expect(screen.queryByText('Início')).not.toBeInTheDocument();
  });
});
