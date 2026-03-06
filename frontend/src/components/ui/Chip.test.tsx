import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from './Chip';

describe('Chip', () => {
  it('renders label', () => {
    render(<Chip label="Tag" />);
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn();
    render(<Chip label="X" onRemove={onRemove} />);
    const btn = screen.getByRole('button', { name: /remover filtro/i });
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('does not show remove button when onRemove not provided', () => {
    render(<Chip label="Only" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
