import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import Header from './Header';

describe('Header', () => {
  const defaultProps = {
    session: null,
    locale: 'pt',
    onLanguageSwitch: vi.fn(),
    resultsLength: 0,
    isPremiumPlan: false,
    onExport: vi.fn(),
    onPricingRedirect: vi.fn(),
    t: (key: string) => key,
  };

  it('renders logo and Planos link', () => {
    renderWithProviders(<Header {...defaultProps} />);
    expect(screen.getByRole('button', { name: /ProspectorAI/ })).toBeInTheDocument();
    expect(screen.getByText('Planos')).toBeInTheDocument();
  });

  it('renders Entrar when session is null', () => {
    renderWithProviders(<Header {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('renders Dashboard button when session is present', () => {
    const session = {
      id: 'u1',
      email: 'u@x.com',
      plan: 'PRO' as const,
      leadsUsed: 0,
      leadsLimit: 100,
    };
    renderWithProviders(<Header {...defaultProps} session={session} />);
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('toggles theme when theme button clicked', () => {
    renderWithProviders(<Header {...defaultProps} />);
    const themeBtn = screen.getByRole('button', { name: /tema escuro|tema claro/i });
    fireEvent.click(themeBtn);
    expect(themeBtn).toBeInTheDocument();
  });

  it('opens menu on mobile menu button', () => {
    renderWithProviders(<Header {...defaultProps} />);
    const menuBtn = screen.getByRole('button', { name: /Abrir menu/i });
    fireEvent.click(menuBtn);
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });
});
