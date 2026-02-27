import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { OnboardingTour } from '@/components/dashboard/OnboardingTour';
import {
  getSectionIdFromPath,
  TOUR_STEPS_BY_SECTION,
  wasTourSeen,
  markTourSeen,
} from '@/lib/tour-steps';

/**
 * Mostra o tour da seção na primeira visita. Rode dentro de DashboardLayout (após Outlet estar montado).
 */
export function DashboardTourTrigger() {
  const location = useLocation();
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    const sectionId = getSectionIdFromPath(location.pathname);
    if (!sectionId) {
      const id = requestAnimationFrame(() => setActiveSectionId(null));
      return () => cancelAnimationFrame(id);
    }
    const steps = TOUR_STEPS_BY_SECTION[sectionId];
    if (!steps?.length || wasTourSeen(sectionId)) {
      const id = requestAnimationFrame(() => setActiveSectionId(null));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() => setActiveSectionId(sectionId));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  const steps = activeSectionId ? TOUR_STEPS_BY_SECTION[activeSectionId] : [];

  const handleComplete = () => {
    if (activeSectionId) markTourSeen(activeSectionId);
    setActiveSectionId(null);
  };

  const handleSkip = () => {
    if (activeSectionId) markTourSeen(activeSectionId);
    setActiveSectionId(null);
  };

  if (!activeSectionId || steps.length === 0) return null;

  return (
    <OnboardingTour
      sectionId={activeSectionId}
      steps={steps}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}
