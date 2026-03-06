import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders input with placeholder', () => {
    render(<Input placeholder="Enter" />);
    expect(screen.getByPlaceholderText('Enter')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<Input error="Invalid value" />);
    expect(screen.getByText('Invalid value')).toBeInTheDocument();
  });

  it('does not show error when error is not set', () => {
    render(<Input placeholder="X" />);
    expect(screen.queryByText('Invalid value')).not.toBeInTheDocument();
  });

  it('forwards ref and supports value', () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} value="test" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
  });
});
