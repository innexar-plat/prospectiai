import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/ui/Sparkline';

describe('Sparkline', () => {
  it('renders nothing with less than 2 data points', () => {
    const { container } = render(<Sparkline data={[5]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders SVG with valid data', () => {
    const { container } = render(<Sparkline data={[1, 3, 2, 5, 4]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelectorAll('path')).toHaveLength(2); // fill + line
  });

  it('respects custom dimensions', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={200} height={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('200');
    expect(svg?.getAttribute('height')).toBe('50');
  });

  it('renders with custom color', () => {
    const { container } = render(<Sparkline data={[1, 2]} color="#FF0000" />);
    const line = container.querySelectorAll('path')[1];
    expect(line?.getAttribute('stroke')).toBe('#FF0000');
  });
});
