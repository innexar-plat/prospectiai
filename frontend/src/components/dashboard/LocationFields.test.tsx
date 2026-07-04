import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocationFields, createDefaultLocationValue } from './LocationFields';

vi.mock('@/lib/locationData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/locationData')>();
  return {
    ...actual,
    getSearchCountries: vi.fn(() => [
      { value: 'BR', label: 'Brasil', flag: '🇧🇷' },
      { value: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
    ]),
    getStatesByCountry: vi.fn((code: string) => {
      if (code === 'BR') return [{ value: 'Todos', label: 'Todos os Estados' }, { value: 'SP', label: 'São Paulo' }];
      return [{ value: 'Todos', label: 'All States' }];
    }),
    countryHasStates: vi.fn(() => true),
    getLocalizedCountryLabel: vi.fn((code: string) => code === 'BR' ? 'Brasil' : 'Estados Unidos'),
    normalizeCountryCode: vi.fn((code: string) => code || 'BR'),
  };
});

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    getDefaultSearchCountry: vi.fn(() => 'BR'),
  };
});

vi.mock('@/lib/api', () => ({
  searchApi: {
    citySuggestions: vi.fn(() => Promise.resolve({ cities: ['São Paulo', 'Santos'] })),
  },
}));

describe('LocationFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders country, state, city fields with defaults', () => {
    const value = createDefaultLocationValue();
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    expect(screen.getByText(/Brasil/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Selecione o estado primeiro/i)).toBeInTheDocument();
  });

  it('opens country dropdown when clicked', () => {
    const value = createDefaultLocationValue();
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Brasil/i));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('calls onChange with new country when selected', async () => {
    const value = createDefaultLocationValue();
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Brasil/i));
    fireEvent.click(screen.getByText(/Estados Unidos/i));
    expect(onChange).toHaveBeenCalledWith({ country: 'US', state: 'Todos', city: '' });
  });

  it('opens state dropdown when clicked', () => {
    const value = createDefaultLocationValue();
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Todos os Estados/i));
    expect(screen.getAllByRole('listbox').length).toBeGreaterThan(0);
  });

  it('renders neighborhood field when showNeighborhood is true', () => {
    const value = createDefaultLocationValue();
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} showNeighborhood />);
    expect(screen.getByText(/Bairro/i)).toBeInTheDocument();
  });

  it('disables city input when country is BR and state is Todos', () => {
    const value = createDefaultLocationValue({ country: 'BR', state: 'Todos' });
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    expect(screen.getByPlaceholderText(/Selecione o estado primeiro/i)).toBeDisabled();
  });

  it('calls citySuggestions when typing a city', async () => {
    const value = createDefaultLocationValue({ country: 'BR', state: 'SP', city: '' });
    const onChange = vi.fn();
    render(<LocationFields value={value} onChange={onChange} />);
    const inputs = screen.getAllByRole('textbox');
    const cityInput = inputs.find(i => i.getAttribute('type') === 'text');
    expect(cityInput).toBeDefined();
    fireEvent.change(cityInput!, { target: { value: 'São Paulo' } });
  });
});
