import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard, LoadingState, EmptyState, PresenceBar } from './DashboardUI';

describe('DashboardUI', () => {
  describe('StatCard', () => {
    it('renders value and label', () => {
      render(<StatCard value={42} label="Leads" color="violet" />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Leads')).toBeInTheDocument();
    });

    it('renders with suffix', () => {
      render(<StatCard value={100} label="Total" color="emerald" suffix="%" />);
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('LoadingState', () => {
    it('renders default message', () => {
      render(<LoadingState />);
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('renders custom message', () => {
      render(<LoadingState message="Aguarde..." />);
      expect(screen.getByText('Aguarde...')).toBeInTheDocument();
    });
  });

  describe('EmptyState', () => {
    const MockIcon = ({ size, className }: { size?: number; className?: string }) => (
      <span data-testid="empty-icon" data-size={size} className={className}>Icon</span>
    );

    it('renders title and description', () => {
      render(
        <EmptyState
          icon={MockIcon}
          title="Nenhum resultado"
          description="Faça uma busca."
        />
      );
      expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
      expect(screen.getByText('Faça uma busca.')).toBeInTheDocument();
    });

    it('calls onAction when button clicked', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          icon={MockIcon}
          title="Vazio"
          description="Desc"
          actionLabel="Criar"
          onAction={onAction}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('PresenceBar', () => {
    it('renders label and percentage', () => {
      render(<PresenceBar label="Com site" count={30} total={100} color="bg-violet-500" />);
      expect(screen.getByText('Com site')).toBeInTheDocument();
      expect(screen.getByText('30 (30%)')).toBeInTheDocument();
    });
  });
});
