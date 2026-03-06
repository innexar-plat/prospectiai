import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
