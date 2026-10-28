import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { Logo } from './Logo';

describe('Logo', () => {
  it('renders the logo image', () => {
    renderWithProviders(<Logo />);
    const img = document.querySelector('img[alt="Precision"]');
    expect(img).toBeInTheDocument();
  });

  it('applies className to image', () => {
    const { container } = renderWithProviders(<Logo className="custom" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('custom');
  });

  it('renders light and dark variants that follow the theme', () => {
    const { container } = renderWithProviders(<Logo />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.getAttribute('src')).toContain('precision-logo.svg');
    expect(imgs[0]!.className).toContain('dark:hidden');
    expect(imgs[1]!.getAttribute('src')).toContain('precision-logo-dark.svg');
    expect(imgs[1]!.className).toContain('dark:block');
  });

  it('forces a single version with tone', () => {
    const { container } = renderWithProviders(<Logo tone="dark" />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0]!.getAttribute('src')).toContain('precision-logo-dark.svg');
  });
});
