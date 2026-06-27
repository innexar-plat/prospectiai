import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OnboardingTour } from './OnboardingTour';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'common.tour.stepOf') return `Step ${opts?.current} of ${opts?.total}`;
      if (key === 'common.tour.stepAria') return `Tour step ${opts?.current}`;
      const labels: Record<string, string> = {
        'common.tour.closeAria': 'Close tour',
        'common.tour.skip': 'Skip tour',
        'common.tour.complete': 'Finish',
        'common.tour.brandTag': 'Guided tour',
        'common.tour.welcomeHint': 'Quick intro',
        'common.next': 'Next',
        'common.previous': 'Previous',
      };
      return labels[key] ?? key;
    },
  }),
}));

const steps = [
  { target: null, title: 'Welcome', body: 'Intro body', icon: '👋' },
  { target: 'nova-busca', title: 'Search', body: 'Search body', placement: 'bottom' as const },
];

describe('OnboardingTour', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
  });

  it('renders welcome step with step counter and progress', () => {
    render(
      <OnboardingTour
        sectionId="welcome"
        steps={steps}
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Intro body')).toBeInTheDocument();
  });

  it('calls onSkip from skip button on first step', () => {
    const onSkip = vi.fn();
    render(
      <OnboardingTour sectionId="welcome" steps={steps} onComplete={vi.fn()} onSkip={onSkip} />,
    );

    fireEvent.click(screen.getByText('Skip tour'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('advances to next step', async () => {
    document.body.innerHTML = '<section data-tour="nova-busca">Search area</section>';

    render(
      <OnboardingTour sectionId="welcome" steps={steps} onComplete={vi.fn()} onSkip={vi.fn()} />,
    );

    fireEvent.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('prefers a visible duplicate tour target on mobile', async () => {
    document.body.innerHTML = `
      <a data-tour="header-credits" style="display:none">Hidden credits</a>
      <a data-tour="header-credits">Visible credits</a>
    `;

    const creditSteps = [
      { target: 'header-credits', title: 'Credits', body: 'Credits body', placement: 'bottom' as const },
    ];

    render(
      <OnboardingTour sectionId="checkout-credits" steps={creditSteps} onComplete={vi.fn()} onSkip={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Credits')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
