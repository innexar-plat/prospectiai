import { useEffect, useState } from 'react';
import { OnboardingTour } from '@/components/dashboard/OnboardingTour';
import { WELCOME_TOUR_STEPS, wasWelcomeTourDone, markWelcomeTourDone } from '@/lib/tour-steps';

/**
 * Mostra o tour de boas-vindas uma única vez na primeira visita ao dashboard.
 * Ao concluir ou pular, o tour não é mais exibido.
 */
export function DashboardTourTrigger() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setShowWelcome(!wasWelcomeTourDone());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleComplete = () => {
    markWelcomeTourDone();
    setShowWelcome(false);
  };

  const handleSkip = () => {
    markWelcomeTourDone();
    setShowWelcome(false);
  };

  if (!showWelcome || WELCOME_TOUR_STEPS.length === 0) return null;

  return (
    <OnboardingTour
      sectionId="welcome"
      steps={WELCOME_TOUR_STEPS}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
