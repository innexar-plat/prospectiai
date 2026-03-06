import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchActionBar } from './SearchActionBar';

describe('SearchActionBar', () => {
  it('renders title and button', () => {
    const onIniciarBusca = vi.fn();
    render(<SearchActionBar onIniciarBusca={onIniciarBusca} />);
    expect(screen.getByText(/Pronto para prospectar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Busca IA/ })).toBeInTheDocument();
  });

  it('shows estimated credits', () => {
    render(<SearchActionBar onIniciarBusca={() => {}} estimatedCredits={3} />);
    expect(screen.getByText('3 Crédito(s)')).toBeInTheDocument();
  });

  it('calls onIniciarBusca when button clicked', () => {
    const onIniciarBusca = vi.fn();
    render(<SearchActionBar onIniciarBusca={onIniciarBusca} />);
    fireEvent.click(screen.getByRole('button', { name: /Iniciar Busca IA/ }));
    expect(onIniciarBusca).toHaveBeenCalledTimes(1);
  });

  it('shows loading state and disables button', () => {
    render(<SearchActionBar onIniciarBusca={() => {}} loading />);
    const btn = screen.getByRole('button', { name: /Buscando/ });
    expect(btn).toBeDisabled();
  });
});
