import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchParamsLocationCard } from './SearchParamsLocationCard';

const defaultValue = {
  country: 'BR',
  state: 'SP',
  city: 'São Paulo',
  radiusKm: 25,
};

describe('SearchParamsLocationCard', () => {
  it('renders title and localização section', () => {
    const onChange = vi.fn();
    render(<SearchParamsLocationCard value={defaultValue} onChange={onChange} />);
    expect(screen.getByText('Localização')).toBeInTheDocument();
    expect(screen.getByText(/Geografia do Lead/)).toBeInTheDocument();
  });

  it('renders with disabled', () => {
    const onChange = vi.fn();
    render(<SearchParamsLocationCard value={defaultValue} onChange={onChange} disabled />);
    expect(screen.getByRole('button', { name: /Configurações de localização/ })).toBeInTheDocument();
  });
});
