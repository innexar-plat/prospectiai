import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import {
  IntelligenceErrorBanner,
  AiInsightsPanel,
} from './IntelligenceUI';

describe('IntelligenceUI', () => {
  describe('IntelligenceErrorBanner', () => {
    it('renders message and retry button', () => {
      const onRetry = vi.fn();
      render(<IntelligenceErrorBanner message="Falha na análise" onRetry={onRetry} />);
      expect(screen.getByText('Falha na análise')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('AiInsightsPanel', () => {
    it('renders summary, chips and tabbed items', () => {
      render(
        <AiInsightsPanel
          title="Insights IA"
          summary="Mercado em crescimento."
          summaryLabel="Resumo"
          chips={[{ label: '3 tendências', tone: 'blue' }]}
          tabs={[
            { key: 'trends', label: 'Tendências', icon: TrendingUp, items: ['Tendência A'], bulletClass: 'text-blue-500' },
            { key: 'opps', label: 'Oportunidades', items: ['Opp B'] },
          ]}
        />,
      );
      expect(screen.getByText('Insights IA')).toBeInTheDocument();
      expect(screen.getByText('Mercado em crescimento.')).toBeInTheDocument();
      expect(screen.getByText('3 tendências')).toBeInTheDocument();
      expect(screen.getByText('Tendência A')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /oportunidades/i }));
      expect(screen.getByText('Opp B')).toBeInTheDocument();
    });
  });
});
