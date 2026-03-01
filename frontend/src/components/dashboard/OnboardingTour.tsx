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
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] pointer-events-auto transition-opacity"
        onClick={handleSkip}
        onKeyDown={(e) => e.key === 'Escape' && handleSkip()}
        role="button"
        tabIndex={0}
        aria-label="Fechar e não mostrar novamente"
      />

      {targetRect && (
        <div
          className="absolute pointer-events-none border-2 border-violet-400 rounded-xl bg-violet-500/5 transition-all duration-300 shadow-[0_0_0_4px_rgba(139,92,246,0.15)]"
          style={{
            left: targetRect.left - 10,
            top: targetRect.top - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
          }}
        />
      )}

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(400px,92vw)] pointer-events-auto rounded-2xl border border-border bg-card shadow-2xl p-6 flex flex-col gap-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === stepIndex ? 'w-5 bg-violet-500' : 'w-1.5 bg-muted'}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-2 -mr-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
            aria-label="Pular e não mostrar novamente"
          >
            <X size={20} />
          </button>
        </div>

        <h3 id="tour-title" className="text-xl font-bold text-foreground leading-tight">
          {step.title}
        </h3>
        <p id="tour-body" className="text-sm text-muted leading-relaxed">
          {step.body}
        </p>

        <div className="flex items-center justify-between gap-4 pt-1">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-muted hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Pular e não mostrar novamente
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-violet-600/20"
          >
            {isLast ? 'Concluir' : 'Próximo'}
            {!isLast && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
