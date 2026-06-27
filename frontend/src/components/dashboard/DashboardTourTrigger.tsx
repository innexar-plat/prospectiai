import { useEffect, useState } from 'react';
import {
  getCheckoutCreditsTourSteps,
  getWelcomeTourSteps,
  wasWelcomeTourDone,
  markWelcomeTourDone,
} from '@/lib/tour-steps';
import { OnboardingTour } from '@/components/dashboard/OnboardingTour';
import { useI18n } from '@/lib/i18n';
import { clearPendingCreditsTour, isPendingCreditsTour } from '@/lib/post-auth-redirect';

/**
 * Mostra o tour de créditos após checkout e o tour de boas-vindas na primeira visita ao dashboard.
 */
export function DashboardTourTrigger() {
  const { t } = useI18n();
  const [showCheckoutCredits, setShowCheckoutCredits] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const checkoutSteps = getCheckoutCreditsTourSteps(t);
  const welcomeSteps = getWelcomeTourSteps(t);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (isPendingCreditsTour()) {
        setShowCheckoutCredits(true);
        return;
      }
      setShowWelcome(!wasWelcomeTourDone());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleCheckoutCreditsDone = () => {
    clearPendingCreditsTour();
    setShowCheckoutCredits(false);
    if (!wasWelcomeTourDone()) {
      setShowWelcome(true);
    }
  };

  const handleWelcomeComplete = () => {
    markWelcomeTourDone();
    setShowWelcome(false);
  };

  const handleWelcomeSkip = () => {
    markWelcomeTourDone();
    setShowWelcome(false);
  };

  if (showCheckoutCredits && checkoutSteps.length > 0) {
    return (
      <OnboardingTour
        sectionId="checkout-credits"
        steps={checkoutSteps}
        onComplete={handleCheckoutCreditsDone}
        onSkip={handleCheckoutCreditsDone}
      />
    );
  }

  if (!showWelcome || welcomeSteps.length === 0) return null;

  return (
    <OnboardingTour
      sectionId="welcome"
      steps={welcomeSteps}
      onComplete={handleWelcomeComplete}
      onSkip={handleWelcomeSkip}
    />
  );
}
