import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Content</Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies padding variant', () => {
    const { container } = render(<Card padding="sm">X</Card>);
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('forwards ref', () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<Card ref={ref}>X</Card>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('renders as heading', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
  });
});

describe('CardDescription', () => {
  it('renders text', () => {
    render(<CardDescription>Desc</CardDescription>);
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });
});
