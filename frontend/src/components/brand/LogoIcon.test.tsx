import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LogoIcon } from './LogoIcon';

describe('LogoIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<LogoIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
  });

  it('applies size', () => {
    const { container } = render(<LogoIcon size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('applies className', () => {
    const { container } = render(<LogoIcon className="w-8 h-8" />);
    expect(container.querySelector('svg')).toHaveClass('w-8', 'h-8');
  });
});
