import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders with text by default', () => {
    renderWithProviders(<Logo />);
    expect(screen.getByText(/Prospector/)).toBeInTheDocument();
  });

  it('renders icon only when iconOnly is true', () => {
    renderWithProviders(<Logo iconOnly />);
    expect(screen.queryByText(/Prospector/)).not.toBeInTheDocument();
    const img = document.querySelector('img[alt=""]');
    expect(img).toBeInTheDocument();
  });

  it('applies className to container', () => {
    const { container } = renderWithProviders(<Logo className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });
});
