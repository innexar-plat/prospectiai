import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchSegmentRow } from './SearchSegmentRow';

const defaultValue = {
  niches: [],
  advancedTerm: '',
};

describe('SearchSegmentRow', () => {
  it('renders Categoria label', () => {
    const onChange = vi.fn();
    render(<SearchSegmentRow value={defaultValue} onChange={onChange} />);
    expect(screen.getByText('Categoria')).toBeInTheDocument();
  });
});
