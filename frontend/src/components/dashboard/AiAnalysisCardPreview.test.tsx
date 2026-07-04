import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiAnalysisCardPreview } from './AiAnalysisCardPreview';

vi.mock('@/lib/analysis-preview', () => ({
  getAiPainPreview: vi.fn((source: unknown) => {
    if ((source as { pain?: string }).pain) return (source as { pain: string }).pain;
    return null;
  }),
  getAiApproachPreview: vi.fn((source: unknown) => {
    if ((source as { approach?: string }).approach) return (source as { approach: string }).approach;
    return null;
  }),
}));

describe('AiAnalysisCardPreview', () => {
  it('renders pain preview text', () => {
    const source = { pain: 'Cliente reclama de demora', approach: null };
    render(<AiAnalysisCardPreview source={source as never} />);
    expect(screen.getByText('Cliente reclama de demora')).toBeInTheDocument();
  });

  it('renders approach preview text', () => {
    const source = { pain: null, approach: 'Abordagem personalizada' };
    render(<AiAnalysisCardPreview source={source as never} />);
    expect(screen.getByText('Abordagem personalizada')).toBeInTheDocument();
  });

  it('renders both pain and approach when both present', () => {
    const source = { pain: 'Problema X', approach: 'Solução Y' };
    render(<AiAnalysisCardPreview source={source as never} />);
    expect(screen.getByText('Problema X')).toBeInTheDocument();
    expect(screen.getByText('Solução Y')).toBeInTheDocument();
  });

  it("returns null when neither pain nor approach exist", () => {
    const { container } = render(<AiAnalysisCardPreview source={{} as never} />);
    expect(container.innerHTML).toBe('');
  });
});
