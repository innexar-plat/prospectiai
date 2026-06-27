import type { CSSProperties } from 'react';

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PopoverLayout = {
  placement: TourPlacement;
  style: CSSProperties;
  arrowStyle: CSSProperties;
  showArrow: boolean;
};

const VIEWPORT_MARGIN = 16;
const GAP = 14;
const ARROW = 10;
const MIN_TIP_HEIGHT = 140;
const SIDEBAR_MIN_LEFT = 240;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function buildHighlightRect(rect: DOMRect | null, pad: number): HighlightRect | null {
  if (!rect) return null;
  return {
    left: rect.left - pad,
    top: rect.top - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

type LayoutInput = {
  hl: HighlightRect | null;
  preferred?: TourPlacement;
  isMobile: boolean;
  vw: number;
  vh: number;
  tipWidth: number;
  targetId: string | null;
};

function pickPlacement(input: LayoutInput): TourPlacement {
  const { hl, preferred, isMobile, vw, vh, tipWidth } = input;
  if (!hl) return 'center';

  if (input.targetId === 'sidebar-nav') return 'right';

  const spaceBelow = vh - (hl.top + hl.height + GAP + ARROW) - VIEWPORT_MARGIN;
  const spaceAbove = hl.top - GAP - ARROW - VIEWPORT_MARGIN;
  const spaceRight = vw - (hl.left + hl.width + GAP + ARROW) - VIEWPORT_MARGIN;
  const spaceLeft = hl.left - GAP - ARROW - VIEWPORT_MARGIN;

  let placement = preferred ?? 'bottom';
  if (isMobile) {
    if (spaceBelow >= MIN_TIP_HEIGHT) return 'bottom';
    if (spaceAbove >= MIN_TIP_HEIGHT) return 'top';
    return 'center';
  }

  if (placement === 'bottom' && spaceBelow < MIN_TIP_HEIGHT && spaceAbove >= spaceBelow) placement = 'top';
  else if (placement === 'top' && spaceAbove < MIN_TIP_HEIGHT && spaceBelow >= spaceAbove) placement = 'bottom';
  else if (placement === 'right' && spaceRight < tipWidth && spaceLeft >= spaceRight) placement = 'left';
  else if (placement === 'left' && spaceLeft < tipWidth && spaceRight >= spaceLeft) placement = 'right';

  if (placement === 'right' && spaceRight < tipWidth * 0.75) {
    return spaceBelow >= MIN_TIP_HEIGHT ? 'bottom' : 'center';
  }

  return placement;
}

function arrowStyleForPlacement(
  placement: TourPlacement,
  hl: HighlightRect,
  popoverLeft: number,
  popoverTop: number,
  popoverWidth: number,
  popoverHeight: number,
): CSSProperties {
  const targetCenterX = hl.left + hl.width / 2;
  const targetCenterY = hl.top + hl.height / 2;
  const base: CSSProperties = {
    position: 'absolute',
    width: ARROW,
    height: ARROW,
    background: 'var(--card, #fff)',
    border: '1px solid rgba(16, 71, 218, 0.12)',
    transform: 'rotate(45deg)',
    pointerEvents: 'none',
  };

  switch (placement) {
    case 'bottom':
      return {
        ...base,
        top: -ARROW / 2 - 1,
        left: clamp(targetCenterX - popoverLeft - ARROW / 2, 20, popoverWidth - 20),
        borderRight: 'none',
        borderBottom: 'none',
      };
    case 'top':
      return {
        ...base,
        bottom: -ARROW / 2 - 1,
        left: clamp(targetCenterX - popoverLeft - ARROW / 2, 20, popoverWidth - 20),
        borderLeft: 'none',
        borderTop: 'none',
      };
    case 'right':
      return {
        ...base,
        left: -ARROW / 2 - 1,
        top: clamp(targetCenterY - popoverTop - ARROW / 2, 20, popoverHeight - 20),
        borderTop: 'none',
        borderRight: 'none',
      };
    case 'left':
      return {
        ...base,
        right: -ARROW / 2 - 1,
        top: clamp(targetCenterY - popoverTop - ARROW / 2, 20, popoverHeight - 20),
        borderBottom: 'none',
        borderLeft: 'none',
      };
    default:
      return { display: 'none' };
  }
}

export function computePopoverLayout(input: LayoutInput): PopoverLayout {
  const { hl, vw, vh, tipWidth } = input;
  const maxTipHeight = vh - VIEWPORT_MARGIN * 2;
  const placement = pickPlacement(input);

  if (!hl || placement === 'center') {
    return {
      placement: 'center',
      showArrow: false,
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: tipWidth,
        maxHeight: maxTipHeight,
      },
      arrowStyle: { display: 'none' },
    };
  }

  const centerX = hl.left + hl.width / 2;
  const base: CSSProperties = { position: 'fixed', width: tipWidth, maxHeight: maxTipHeight };

  if (placement === 'bottom') {
    const top = hl.top + hl.height + GAP + ARROW;
    const left = clamp(centerX - tipWidth / 2, VIEWPORT_MARGIN, vw - tipWidth - VIEWPORT_MARGIN);
    const maxHeight = Math.min(vh - top - VIEWPORT_MARGIN, maxTipHeight);
    const style = { ...base, left, top, maxHeight };
    return {
      placement,
      showArrow: true,
      style,
      arrowStyle: arrowStyleForPlacement('bottom', hl, left, top, tipWidth, maxHeight),
    };
  }

  if (placement === 'top') {
    const bottom = vh - hl.top + GAP + ARROW;
    const left = clamp(centerX - tipWidth / 2, VIEWPORT_MARGIN, vw - tipWidth - VIEWPORT_MARGIN);
    const maxHeight = Math.min(hl.top - GAP - ARROW - VIEWPORT_MARGIN, maxTipHeight);
    const top = vh - bottom - maxHeight;
    const style = { ...base, left, top, maxHeight };
    return {
      placement,
      showArrow: true,
      style,
      arrowStyle: arrowStyleForPlacement('top', hl, left, top, tipWidth, maxHeight),
    };
  }

  if (placement === 'right') {
    let left = hl.left + hl.width + GAP + ARROW;
    if (input.targetId === 'sidebar-nav') {
      left = Math.max(left, SIDEBAR_MIN_LEFT);
    }
    left = clamp(left, VIEWPORT_MARGIN, vw - tipWidth - VIEWPORT_MARGIN);
    const top = clamp(hl.top, VIEWPORT_MARGIN, vh - MIN_TIP_HEIGHT - VIEWPORT_MARGIN);
    const maxHeight = Math.min(vh - top - VIEWPORT_MARGIN, maxTipHeight);
    const style = { ...base, left, top, maxHeight };
    return {
      placement,
      showArrow: true,
      style,
      arrowStyle: arrowStyleForPlacement('right', hl, left, top, tipWidth, maxHeight),
    };
  }

  let left = hl.left - tipWidth - GAP - ARROW;
  left = clamp(left, VIEWPORT_MARGIN, vw - tipWidth - VIEWPORT_MARGIN);
  const top = clamp(hl.top, VIEWPORT_MARGIN, vh - MIN_TIP_HEIGHT - VIEWPORT_MARGIN);
  const maxHeight = Math.min(vh - top - VIEWPORT_MARGIN, maxTipHeight);
  const style = { ...base, left, top, maxHeight };
  return {
    placement: 'left',
    showArrow: true,
    style,
    arrowStyle: arrowStyleForPlacement('left', hl, left, top, tipWidth, maxHeight),
  };
}

export const TOUR_STEP_EVENT = 'prospector-tour-step';

export function dispatchTourStep(target: string | null, index: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOUR_STEP_EVENT, { detail: { target, index } }));
}
