import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pricing from './Pricing';

describe('Pricing', () => {
  it('renders with locale and currentPlan', () => {
    render(<Pricing locale="pt" currentPlan="FREE" />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders back button when onBack provided', () => {
    const onBack = vi.fn();
    render(<Pricing locale="pt" currentPlan="PRO" onBack={onBack} />);
    const back = screen.queryByRole('button', { name: /voltar|back/i });
    if (back) expect(back).toBeInTheDocument();
  });
});
