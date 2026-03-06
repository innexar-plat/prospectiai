import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@/components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders a div with animate-pulse', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveClass('animate-pulse', 'rounded-md');
  });

  it('merges className', () => {
    const { container } = render(<Skeleton className="w-20 h-4" />);
    expect(container.firstChild).toHaveClass('w-20', 'h-4');
  });
});
