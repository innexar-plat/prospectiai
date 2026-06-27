import { useEffect, useState, useCallback, useRef, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import type { TourStep } from '@/lib/tour-steps';
import { useI18n } from '@/lib/i18n';
import { LogoIcon } from '@/components/brand/LogoIcon';
import {
  buildHighlightRect,
  computePopoverLayout,
  dispatchTourStep,
  type HighlightRect,
} from '@/lib/tour-placement';

type Props = {
  sectionId: string;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
};

const HIGHLIGHT_PAD = 6;
const BRAND = '#1047da';

function SpotlightOverlay({ hl, maskId }: { hl: HighlightRect | null; maskId: string }) {
  if (!hl) {
    return <div className="absolute inset-0 bg-black/40 transition-opacity duration-300" aria-hidden />;
  }

  const rx = 10;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect
            x={hl.left}
            y={hl.top}
            width={hl.width}
            height={hl.height}
            rx={rx}
            ry={rx}
            fill="black"
          />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(15, 23, 42, 0.52)" mask={`url(#${maskId})`} />
      <rect
        x={hl.left}
        y={hl.top}
        width={hl.width}
        height={hl.height}
        rx={rx}
        ry={rx}
        fill="none"
        stroke={BRAND}
        strokeWidth={2}
        strokeOpacity={0.85}
        style={{ filter: 'drop-shadow(0 0 12px rgba(16, 71, 218, 0.35))' }}
      />
    </svg>
  );
}

export function OnboardingTour({ sectionId, steps, onComplete, onSkip }: Props) {
  const { t } = useI18n();
  const maskId = useId().replace(/:/g, '');
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tipVisible, setTipVisible] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const scrollYRef = useRef(0);

  const step = steps[idx];
  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const isWelcome = !step?.target;

  const skip = useCallback(() => onSkip(), [onSkip]);
  const prev = useCallback(() => {
    setTipVisible(false);
    setIdx((i) => Math.max(0, i - 1));
  }, []);
  const next = useCallback(() => {
    if (isLast) {
      onComplete();
      return;
    }
    setTipVisible(false);
    setIdx((i) => i + 1);
  }, [isLast, onComplete]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchRef.current.x;
      const dy = touch.clientY - touchRef.current.y;
      touchRef.current = null;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      if (dx < 0) next();
      else prev();
    },
    [next, prev],
  );

  useEffect(() => {
    scrollYRef.current = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollYRef.current);
    };
  }, []);

  const measureTarget = useCallback((target: string | null) => {
    if (!target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, []);

  useEffect(() => {
    if (!step) return;

    setTipVisible(false);
    dispatchTourStep(step.target, idx);

    if (!step.target) {
      setRect(null);
      const timer = setTimeout(() => setTipVisible(true), 80);
      return () => clearTimeout(timer);
    }

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      const timer = setTimeout(() => setTipVisible(true), 80);
      return () => clearTimeout(timer);
    }

    el.scrollIntoView({
      behavior: 'smooth',
      block: isMobile ? 'center' : 'nearest',
      inline: 'nearest',
    });

    const timer = setTimeout(() => {
      measureTarget(step.target);
      setTipVisible(true);
    }, isMobile ? 450 : 350);

    return () => clearTimeout(timer);
  }, [step, idx, isMobile, measureTarget]);

  useEffect(() => {
    if (!step?.target) return;
    const refresh = () => measureTarget(step.target);
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [step?.target, measureTarget]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') skip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [skip, next, prev]);

  const progress = ((idx + 1) / steps.length) * 100;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const tipWidth = isMobile ? Math.min(340, vw - 32) : Math.min(420, vw - 32);

  const hl = useMemo(() => buildHighlightRect(rect, HIGHLIGHT_PAD), [rect]);

  const popover = useMemo(
    () =>
      computePopoverLayout({
        hl,
        preferred: step?.placement,
        isMobile,
        vw,
        vh,
        tipWidth,
        targetId: step?.target ?? null,
      }),
    [hl, step?.placement, step?.target, isMobile, vw, vh, tipWidth],
  );

  if (!step) return null;

  const overlay = (
    <div
      className="fixed inset-0"
      style={{ zIndex: 99999 }}
      aria-live="polite"
      aria-label={t('common.tour.stepAria', { current: idx + 1, total: steps.length })}
      data-tour-overlay={sectionId}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SpotlightOverlay hl={hl} maskId={maskId} />

      <div
        className="rounded-2xl border border-[#1047da]/15 bg-card text-foreground shadow-[0_24px_64px_-12px_rgba(15,23,42,0.35)] overflow-hidden"
        style={{
          ...popover.style,
          pointerEvents: tipVisible ? 'auto' : 'none',
          opacity: tipVisible ? 1 : 0,
          transition: 'opacity 0.22s ease-out, top 0.28s ease-out, left 0.28s ease-out',
        }}
        role="dialog"
        aria-modal="true"
      >
        {popover.showArrow && hl && (
          <span style={popover.arrowStyle} aria-hidden />
        )}

        {isWelcome && (
          <div
            className="px-5 pt-5 pb-4 border-b border-border/60 bg-gradient-to-br from-[#1047da]/10 via-[#1047da]/5 to-transparent"
            aria-hidden
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#1047da]/10 flex items-center justify-center ring-1 ring-[#1047da]/20">
                <LogoIcon size={28} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1047da]">
                  {t('common.tour.brandTag')}
                </p>
                <p className="text-xs text-muted">{t('common.tour.welcomeHint')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pt-4 pb-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'inherit' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted">
                {t('common.tour.stepOf', { current: idx + 1, total: steps.length })}
              </p>
              <div className="h-1 rounded-full bg-border/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#1047da] transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={skip}
              className="shrink-0 p-2 -mr-1 -mt-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label={t('common.tour.closeAria')}
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground leading-snug tracking-tight flex items-center gap-2">
              {step.icon && (
                <span className="text-xl leading-none" aria-hidden>
                  {step.icon}
                </span>
              )}
              {step.title}
            </h3>
            <p className="text-sm text-muted leading-relaxed">{step.body}</p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="min-w-0">
              {!isFirst ? (
                <button
                  type="button"
                  onClick={prev}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground hover:bg-card hover:border-[#1047da]/25 transition-colors min-h-[44px]"
                >
                  <ChevronLeft size={16} aria-hidden />
                  {t('common.previous')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={skip}
                  className="px-3 py-2.5 text-sm font-medium text-muted hover:text-foreground transition-colors min-h-[44px]"
                >
                  {t('common.tour.skip')}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1047da] hover:bg-[#0d3bb8] text-white text-sm font-semibold transition-colors shadow-[0_4px_14px_rgba(16,71,218,0.28)] min-h-[44px]"
            >
              {isLast ? t('common.tour.complete') : t('common.next')}
              {!isLast && <ChevronRight size={16} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
