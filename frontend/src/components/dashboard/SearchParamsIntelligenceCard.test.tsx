import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchParamsIntelligenceCard } from './SearchParamsIntelligenceCard';

const defaultValue = {
  niches: [],
  advancedTerm: '',
};

describe('SearchParamsIntelligenceCard', () => {
  it('renders title and presets', () => {
    const onChange = vi.fn();
    render(<SearchParamsIntelligenceCard value={defaultValue} onChange={onChange} />);
    expect(screen.getByText('Inteligência')).toBeInTheDocument();
    expect(screen.getByText('SaaS')).toBeInTheDocument();
  });

  it('calls onChange when preset niche clicked', () => {
    const onChange = vi.fn();
    render(<SearchParamsIntelligenceCard value={defaultValue} onChange={onChange} />);
    fireEvent.click(screen.getByText('SaaS'));
    expect(onChange).toHaveBeenCalledWith({ niches: ['SaaS'] });
  });

  it('removes niche when clicked again', () => {
    const onChange = vi.fn();
    render(
      <SearchParamsIntelligenceCard
        value={{ ...defaultValue, niches: ['SaaS'] }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('SaaS'));
    expect(onChange).toHaveBeenCalledWith({ niches: [] });
  });

  it('shows advanced term input', () => {
    const onChange = vi.fn();
    render(
      <SearchParamsIntelligenceCard
        value={{ ...defaultValue, advancedTerm: 'test' }}
        onChange={onChange}
      />
    );
    const input = screen.getByDisplayValue('test');
    expect(input).toBeInTheDocument();
  });
});
