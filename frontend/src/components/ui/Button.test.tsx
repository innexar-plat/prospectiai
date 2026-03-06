import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies variant and size via class', () => {
    const { container } = render(<Button variant="secondary" size="sm">Ok</Button>);
    const btn = container.querySelector('button');
    expect(btn).toHaveClass('rounded-2xl');
  });

  it('is disabled when isLoading', () => {
    render(<Button isLoading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards ref and extra props', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(<Button ref={ref} data-testid="btn">X</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(screen.getByTestId('btn')).toBeInTheDocument();
  });
});
