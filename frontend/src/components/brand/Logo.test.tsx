import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the logo image', () => {
    renderWithProviders(<Logo />);
    const img = document.querySelector('img[alt="Precision IA"]');
    expect(img).toBeInTheDocument();
  });

  it('applies className to container', () => {
    const { container } = renderWithProviders(<Logo className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});
