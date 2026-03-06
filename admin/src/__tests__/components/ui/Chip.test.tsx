import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chip } from '@/components/ui/Chip';

describe('Chip', () => {
  it('renders label', () => {
    render(<Chip label="Tag" />);
    expect(screen.getByText('Tag')).toBeInTheDocument();
  });

  it('does not show remove button when onRemove is not provided', () => {
    render(<Chip label="X" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', async () => {
    const onRemove = vi.fn();
    render(<Chip label="Y" onRemove={onRemove} />);
    const btn = screen.getByRole('button', { name: /remover filtro/i });
    fireEvent.click(btn);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('merges className', () => {
    const { container } = render(<Chip label="Z" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
