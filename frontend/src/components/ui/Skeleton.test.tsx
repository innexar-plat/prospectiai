import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders a div with animate-pulse', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('animate-pulse');
  });

  it('merges className', () => {
    const { container } = render(<Skeleton className="w-8 h-8" />);
    expect(container.firstChild).toHaveClass('w-8', 'h-8');
  });
});
