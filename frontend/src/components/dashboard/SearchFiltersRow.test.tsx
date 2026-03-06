import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchFiltersRow } from './SearchFiltersRow';

const defaultValue = {
  country: 'BR',
  state: 'SP',
  city: 'São Paulo',
  radiusKm: 25,
};

describe('SearchFiltersRow', () => {
  it('renders País and location filters', () => {
    const onChange = vi.fn();
    render(<SearchFiltersRow value={defaultValue} onChange={onChange} />);
    expect(screen.getByText('País')).toBeInTheDocument();
  });
});
