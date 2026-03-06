import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeaderDashboard } from './HeaderDashboard';

describe('HeaderDashboard', () => {
  it('renders title and subtitle by default', () => {
    render(<HeaderDashboard />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Parâmetros de Busca')).toBeInTheDocument();
    expect(screen.getByText(/Configure seu público-alvo/)).toBeInTheDocument();
  });

  it('renders custom title and breadcrumb', () => {
    render(
      <HeaderDashboard
        title="Minha Busca"
        breadcrumb="Dashboard / Busca"
      />
    );
    expect(screen.getByText('Minha Busca')).toBeInTheDocument();
    expect(screen.getByText('Dashboard / Busca')).toBeInTheDocument();
  });

  it('calls onHistórico when Histórico button clicked', () => {
    const onHistórico = vi.fn();
    render(<HeaderDashboard onHistórico={onHistórico} />);
    fireEvent.click(screen.getByRole('button', { name: /ver histórico de buscas/i }));
    expect(onHistórico).toHaveBeenCalledTimes(1);
  });

  it('calls onIniciarBusca when Iniciar Busca clicked', () => {
    const onIniciarBusca = vi.fn();
    render(<HeaderDashboard onIniciarBusca={onIniciarBusca} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar busca/i }));
    expect(onIniciarBusca).toHaveBeenCalledTimes(1);
  });

  it('shows loading state on primary button', () => {
    render(<HeaderDashboard onIniciarBusca={() => {}} searchLoading />);
    expect(screen.getByRole('button', { name: /Buscando/ })).toBeDisabled();
  });
});
