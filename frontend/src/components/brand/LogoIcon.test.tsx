import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LogoIcon } from './LogoIcon';
import { BRAND_FAVICON_SRC } from '@/lib/brand';

describe('LogoIcon', () => {
  it('renders the favicon image', () => {
    const { container } = render(<LogoIcon />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', BRAND_FAVICON_SRC);
    expect(img).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies size', () => {
    const { container } = render(<LogoIcon size={48} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('height', '48');
  });

  it('applies className', () => {
    const { container } = render(<LogoIcon className="w-8 h-8" />);
    expect(container.querySelector('img')).toHaveClass('w-8', 'h-8');
  });
});
