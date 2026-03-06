import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '@/components/ui/Select';

describe('Select', () => {
  it('renders select with options', () => {
    render(
      <Select>
        <option value="a">A</option>
        <option value="b">B</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows error when error prop is set', () => {
    render(<Select error="Required"> <option value="">Choose</option> </Select>);
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLSelectElement | null };
    render(
      <Select ref={ref}>
        <option value="">X</option>
      </Select>
    );
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
  });
});
