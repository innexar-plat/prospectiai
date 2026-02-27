import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { TourStep } from '@/lib/tour-steps';

type OnboardingTourProps = {
  sectionId: string;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
};

export function OnboardingTour({ sectionId, steps, onComplete, onSkip }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSkip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  useEffect(() => {
    if (!step?.target || typeof document === 'undefined') {
      const id = requestAnimationFrame(() => setTargetRect(null));
      return () => cancelAnimationFrame(id);
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    const rect = el instanceof HTMLElement ? el.getBoundingClientRect() : null;
    const id = requestAnimationFrame(() => setTargetRect(rect));
    return () => cancelAnimationFrame(id);
  }, [step?.target, stepIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleSkip]);

  if (!step) return null;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      aria-live="polite"
      aria-label={`Tour: passo ${stepIndex + 1} de ${steps.length}`}
      data-tour-section={sectionId}
    >
      {/* Overlay (clickable to skip or just visual) */}
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={handleSkip}
        onKeyDown={(e) => e.key === 'Escape' && handleSkip()}
        role="button"
        tabIndex={0}
        aria-label="Pular tour"
      />

      {/* Highlight around target (optional) */}
      {targetRect && (
        <div
          className="absolute pointer-events-none border-2 border-violet-500 rounded-xl bg-violet-500/10 transition-all duration-200"
          style={{
            left: targetRect.left - 8,
            top: targetRect.top - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* Popover card */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(360px,90vw)] pointer-events-auto rounded-2xl border border-border bg-card shadow-xl p-5 flex flex-col gap-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">
            {stepIndex + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors -mr-1"
            aria-label="Pular tour"
          >
            <X size={18} />
          </button>
        </div>
        <h3 id="tour-title" className="text-lg font-bold text-foreground">
          {step.title}
        </h3>
        <p id="tour-body" className="text-sm text-muted leading-relaxed">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Pular
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            {isLast ? 'Concluir' : 'Próximo'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
