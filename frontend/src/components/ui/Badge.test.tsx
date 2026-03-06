import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<Badge ref={ref}>X</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('applies variant class', () => {
    const { container } = render(<Badge variant="success">Ok</Badge>);
    expect(container.firstChild).toHaveClass('rounded-full');
  });
});
