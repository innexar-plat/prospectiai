import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CnaeAutocomplete } from './CnaeAutocomplete';

vi.mock('@/lib/api', () => ({
  cnaeApi: {
    search: vi.fn(() =>
      Promise.resolve({
        codes: [
          { code: '7020400', description: 'Atividades de consultoria' },
          { code: '6202300', description: 'Desenvolvimento de software' },
        ],
      })
    ),
  },
}));

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    getActiveMarket: vi.fn(() => 'BR'),
  };
});

describe('CnaeAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with placeholder', () => {
    render(<CnaeAutocomplete values={[]} onChange={() => {}} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows suggestions when typing', async () => {
    render(<CnaeAutocomplete values={[]} onChange={() => {}} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'consul' } });
    await waitFor(() => {
      expect(screen.getByText('70.20-4-00')).toBeInTheDocument();
    });
  });

  it('calls onChange when a code is selected', async () => {
    const onChange = vi.fn();
    render(<CnaeAutocomplete values={[]} onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'consul' } });
    await waitFor(() => {
      expect(screen.getByText('70.20-4-00')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('70.20-4-00'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['7020400'], 'Atividades de consultoria');
    });
  });

  it('rejects query shorter than 2 characters', () => {
    render(<CnaeAutocomplete values={[]} onChange={() => {}} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
