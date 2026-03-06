import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminFooter } from '@/components/layout/AdminFooter';

describe('AdminFooter', () => {
  it('renders copyright with current year', () => {
    render(<AdminFooter />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`Prospector.AI Admin © ${year}`))).toBeInTheDocument();
  });

  it('renders link to app', () => {
    render(<AdminFooter />);
    const link = screen.getByRole('link', { name: /ir para o app/i });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
