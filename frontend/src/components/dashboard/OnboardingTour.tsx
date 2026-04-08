import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import type { TourStep } from '@/lib/tour-steps';

type Props = {
  sectionId: string;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
};

const PAD = 8;
const GAP = 12;

export function OnboardingTour({ sectionId, steps, onComplete, onSkip }: Props) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const step = steps[idx];
  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const skip = useCallback(() => onSkip(), [onSkip]);
  const prev = useCallback(() => {
    setTipVisible(false);
    setIdx((i) => Math.max(0, i - 1));
  }, []);
  const next = useCallback(() => {
    if (isLast) { onComplete(); return; }
    setTipVisible(false);
    setIdx((i) => i + 1);
  }, [isLast, onComplete]);

  // Swipe support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) next(); else prev();
  }, [next, prev]);

  // Find target, scroll, measure
  useEffect(() => {
    if (!step) return;

    if (!step.target) {
      setRect(null);
      const t = setTimeout(() => setTipVisible(true), 80);
      return () => clearTimeout(t);
    }

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      const t = setTimeout(() => setTipVisible(true), 80);
      return () => clearTimeout(t);
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    const t = setTimeout(() => {
      setRect(el.getBoundingClientRect());
      setTipVisible(true);
    }, 350);
    return () => clearTimeout(t);
  }, [step, idx]);

  // Update rect on resize / scroll
  useEffect(() => {
    if (!step?.target) return;
    const refresh = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [step?.target]);

  // Keyboard
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [skip, next, prev]);

  if (!step) return null;

  const progress = ((idx + 1) / steps.length) * 100;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  // When no target, hl collapses to a zero-size point at viewport center
  // so the 4 overlay rects seamlessly cover everything.
  const hl = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : { left: vw / 2, top: vh / 2, width: 0, height: 0 };

  // Tooltip position
  const tipStyle = (): React.CSSProperties => {
    const tw = isMobile ? Math.min(320, vw - 24) : Math.min(380, vw * 0.9);

    // No target = centered modal
    if (!rect) {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: tw, maxHeight: vh - 48 };
    }

    // On mobile, always position below or above the target (no left/right)
    if (isMobile) {
      const l = Math.max(12, (vw - tw) / 2);
      const spaceBelow = vh - (hl.top + hl.height + GAP);
      const spaceAbove = hl.top - GAP;
      if (spaceBelow >= 200) {
        return { position: 'fixed', left: `${l}px`, top: `${hl.top + hl.height + GAP}px`, width: tw, maxHeight: spaceBelow - 12 };
      }
      if (spaceAbove >= 200) {
        return { position: 'fixed', left: `${l}px`, bottom: `${vh - hl.top + GAP}px`, width: tw, maxHeight: spaceAbove - 12 };
      }
      // Fallback: center
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: tw, maxHeight: vh - 48 };
    }

    const placement = step.placement ?? 'bottom';
    const cx = hl.left + hl.width / 2;
    let l = cx - tw / 2;
    if (l < 12) l = 12;
    if (l + tw > vw - 12) l = vw - tw - 12;

    const base: React.CSSProperties = { position: 'fixed', left: `${l}px`, width: tw };

    switch (placement) {
      case 'top':
        return { ...base, bottom: `${vh - hl.top + GAP}px` };
      case 'right': {
        let rl = hl.left + hl.width + GAP;
        if (rl + tw > vw - 12) rl = Math.max(12, cx - tw / 2);
        return { ...base, top: `${Math.max(12, hl.top)}px`, left: `${Math.min(rl, vw - tw - 12)}px` };
      }
      case 'left': {
        let ll = hl.left - tw - GAP;
        if (ll < 12) ll = Math.max(12, cx - tw / 2);
        return { ...base, top: `${Math.max(12, hl.top)}px`, left: `${Math.max(12, ll)}px` };
      }
      case 'bottom':
      default:
        return { ...base, top: `${hl.top + hl.height + GAP}px` };
    }
  };

  const overlay = (
    <div
      className="fixed inset-0"
      style={{ zIndex: 99999 }}
      aria-live="polite"
      aria-label={`Tour passo ${idx + 1} de ${steps.length}`}
      data-tour-overlay={sectionId}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Invisible click-blocker — prevents interaction with the page behind */}
      <div className="absolute inset-0" />

      {/* 4-rect overlay: each rect is one side of the frame around the highlight hole.
          When highlight transitions between positions the rects animate smoothly. */}
      <div className="absolute left-0 right-0 top-0 bg-black/65 pointer-events-none transition-all duration-300 ease-out"
        style={{ height: Math.max(0, hl.top) }} />
      <div className="absolute left-0 right-0 bg-black/65 pointer-events-none transition-all duration-300 ease-out"
        style={{ top: Math.max(0, hl.top + hl.height), bottom: 0 }} />
      <div className="absolute left-0 bg-black/65 pointer-events-none transition-all duration-300 ease-out"
        style={{ top: Math.max(0, hl.top), height: Math.max(0, hl.height), width: Math.max(0, hl.left) }} />
      <div className="absolute bg-black/65 pointer-events-none transition-all duration-300 ease-out"
        style={{ top: Math.max(0, hl.top), height: Math.max(0, hl.height), left: Math.max(0, hl.left + hl.width), right: 0 }} />

      {/* Highlight border glow (only when a real target is visible) */}
      {rect && (
        <div
          className="absolute rounded-xl border-2 border-violet-400/70 pointer-events-none transition-all duration-300 ease-out"
          style={{
            left: hl.left, top: hl.top, width: hl.width, height: hl.height,
            boxShadow: '0 0 20px rgba(139,92,246,0.3), inset 0 0 20px rgba(139,92,246,0.05)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="rounded-2xl border border-violet-500/30 bg-card shadow-2xl shadow-violet-500/10"
        style={{
          ...tipStyle(),
          pointerEvents: tipVisible ? 'auto' : 'none',
          opacity: tipVisible ? 1 : 0,
          transition: 'opacity 0.25s ease-out',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Progress bar */}
        <div className="h-1 bg-surface rounded-t-2xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 sm:p-5 space-y-2.5 sm:space-y-3 overflow-y-auto" style={{ maxHeight: 'inherit' }}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {step.icon && <span className="text-lg sm:text-xl" aria-hidden>{step.icon}</span>}
              <span className="text-[10px] sm:text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                {idx + 1} de {steps.length}
              </span>
            </div>
            <button
              type="button"
              onClick={skip}
              className="p-2 -mr-2 -mt-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fechar tour"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-black text-foreground leading-tight">{step.title}</h3>
          <p className="text-[13px] sm:text-sm text-muted leading-relaxed">{step.body}</p>

          {/* Step dots */}
          <div className="flex gap-2 pt-1 justify-center" aria-hidden>
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setTipVisible(false); setIdx(i); }}
                className={`rounded-full transition-all min-h-[28px] min-w-[28px] flex items-center justify-center ${
                  i === idx ? '' : ''
                }`}
              >
                <span className={`block rounded-full transition-all ${
                  i === idx ? 'w-6 h-2 bg-violet-500' : i < idx ? 'w-2 h-2 bg-violet-500/40' : 'w-2 h-2 bg-muted/30'
                }`} />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {!isFirst ? (
                <button
                  type="button"
                  onClick={prev}
                  className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-surface transition-colors min-h-[44px]"
                >
                  <ChevronLeft size={16} /> Anterior
                </button>
              ) : (
                <button
                  type="button"
                  onClick={skip}
                  className="text-xs font-medium text-muted/70 hover:text-foreground transition-colors min-h-[44px] px-2"
                >
                  Pular tour
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors shadow-lg shadow-violet-600/20 min-h-[44px]"
            >
              {isLast ? '✓ Concluir' : 'Próximo'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
