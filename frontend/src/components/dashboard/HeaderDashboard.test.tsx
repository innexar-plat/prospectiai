import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test/render-with-i18n';
import { getLocaleStorageKey } from '@/lib/locale';
import { HeaderDashboard } from './HeaderDashboard';

describe('HeaderDashboard', () => {
  beforeEach(() => {
    localStorage.setItem(getLocaleStorageKey(), 'pt');
  });

  it('renders title and subtitle by default', () => {
    renderWithI18n(<HeaderDashboard />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByText('Parâmetros de Busca')).toBeInTheDocument();
    expect(screen.getByText(/Configure seu público-alvo/)).toBeInTheDocument();
  });

  it('renders custom title and breadcrumb', () => {
    renderWithI18n(
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
    renderWithI18n(<HeaderDashboard onHistórico={onHistórico} />);
    fireEvent.click(screen.getByRole('button', { name: /ver histórico de buscas/i }));
    expect(onHistórico).toHaveBeenCalledTimes(1);
  });

  it('calls onIniciarBusca when Iniciar Busca clicked', () => {
    const onIniciarBusca = vi.fn();
    renderWithI18n(<HeaderDashboard onIniciarBusca={onIniciarBusca} />);
    fireEvent.click(screen.getByRole('button', { name: /iniciar busca/i }));
    expect(onIniciarBusca).toHaveBeenCalledTimes(1);
  });

  it('shows loading state on primary button', () => {
    renderWithI18n(<HeaderDashboard onIniciarBusca={() => {}} searchLoading />);
    expect(screen.getByRole('button', { name: /Buscando/ })).toBeDisabled();
  });
});
