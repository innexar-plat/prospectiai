import { describe, it, expect } from 'vitest';
import { buildHighlightRect, computePopoverLayout, clamp } from './tour-placement';

describe('tour-placement', () => {
  it('clamp bounds values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('buildHighlightRect adds padding', () => {
    const rect = new DOMRect(100, 200, 50, 30);
    expect(buildHighlightRect(rect, 8)).toEqual({
      left: 92,
      top: 192,
      width: 66,
      height: 46,
    });
  });

  it('computePopoverLayout centers when no target rect', () => {
    const layout = computePopoverLayout({
      hl: null,
      isMobile: false,
      vw: 1200,
      vh: 800,
      tipWidth: 400,
      targetId: null,
    });
    expect(layout.placement).toBe('center');
    expect(layout.showArrow).toBe(false);
  });

  it('computePopoverLayout prefers right placement for sidebar nav', () => {
    const layout = computePopoverLayout({
      hl: { left: 12, top: 80, width: 200, height: 500 },
      preferred: 'right',
      isMobile: false,
      vw: 1200,
      vh: 800,
      tipWidth: 400,
      targetId: 'sidebar-nav',
    });
    expect(layout.placement).toBe('right');
    expect(layout.showArrow).toBe(true);
    expect(Number(layout.style.left)).toBeGreaterThanOrEqual(240);
  });
});
