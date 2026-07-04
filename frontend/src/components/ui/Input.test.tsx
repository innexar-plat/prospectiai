import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Input } from './Input';

describe('Input', () => {
  it('renders input with placeholder', () => {
    render(<Input placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<Input error="Campo obrigatório" />);
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('forwards ref to input', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} placeholder="X" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('renders icon when provided', () => {
    const { container } = render(<Input icon={<span data-testid="icon">I</span>} />);
    expect(container.querySelector('[data-testid="icon"]')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Input placeholder="Name" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
