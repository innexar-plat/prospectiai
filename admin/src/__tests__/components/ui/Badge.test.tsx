import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/Badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label')).toBeInTheDocument();
  });

  it('applies default variant', () => {
    const { container } = render(<Badge>X</Badge>);
    expect(container.firstChild).toHaveClass('bg-primary/10');
  });

  it('applies success variant', () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveClass('bg-success/15');
  });

  it('applies danger variant', () => {
    const { container } = render(<Badge variant="danger">Err</Badge>);
    expect(container.firstChild).toHaveClass('bg-danger/15');
  });

  it('applies outline variant', () => {
    const { container } = render(<Badge variant="outline">Out</Badge>);
    expect(container.firstChild).toHaveClass('border');
  });

  it('merges className', () => {
    const { container } = render(<Badge className="custom">X</Badge>);
    expect(container.firstChild).toHaveClass('custom');
  });
});
