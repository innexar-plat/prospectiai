import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Select } from './Select';

describe('Select', () => {
  it('renders options', () => {
    render(
      <Select>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<Select error="Invalid"> <option value="x">X</option> </Select>);
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('forwards ref to select', () => {
    const ref = { current: null as HTMLSelectElement | null };
    render(<Select ref={ref}><option value="1">1</option></Select>);
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Select aria-label="Choose"><option value="a">A</option></Select>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
