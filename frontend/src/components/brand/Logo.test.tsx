import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the logo image', () => {
    renderWithProviders(<Logo />);
    const img = document.querySelector('img[alt="PrecisionAI"]');
    expect(img).toBeInTheDocument();
  });

  it('applies className to image', () => {
    const { container } = renderWithProviders(<Logo className="custom" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('custom');
  });
});
