import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithI18n } from '@/test/render-with-i18n';
import { ResultCardAnalyzeButton } from './ResultCardAnalyzeButton';

describe('ResultCardAnalyzeButton', () => {
  it('renders primary analyze CTA when no score', () => {
    renderWithI18n(
      <ResultCardAnalyzeButton
        isAnalyzing={false}
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /analisar com ia/i })).toBeInTheDocument();
  });

  it('shows analyzing state and disables interaction', () => {
    renderWithI18n(
      <ResultCardAnalyzeButton
        isAnalyzing
        onAnalyze={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /analisando/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('renders re-analyze with AI score badge when analysis exists', () => {
    renderWithI18n(
      <ResultCardAnalyzeButton
        score={82}
        isAnalyzing={false}
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /reanalisar/i })).toBeInTheDocument();
    expect(screen.getByText(/ia 82/i)).toBeInTheDocument();
  });

  it('calls onAnalyze when clicked', () => {
    const onAnalyze = vi.fn();
    renderWithI18n(
      <ResultCardAnalyzeButton
        isAnalyzing={false}
        onAnalyze={onAnalyze}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /analisar com ia/i }));
    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('respects disabled prop when batch job is running', () => {
    renderWithI18n(
      <ResultCardAnalyzeButton
        score={70}
        isAnalyzing={false}
        disabled
        onAnalyze={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /reanalisar/i })).toBeDisabled();
  });
});
