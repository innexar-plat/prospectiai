import { describe, it, expect, afterEach } from 'vitest';
import {
  getCheckoutCreditsTourSteps,
  getWelcomeTourSteps,
  getTourStepsBySection,
  TOUR_STORAGE_PREFIX,
  WELCOME_TOUR_STORAGE_KEY,
  getSectionIdFromPath,
  getTourStorageKey,
  wasTourSeen,
  markTourSeen,
  wasWelcomeTourDone,
  markWelcomeTourDone,
  clearAllTourFlags,
} from './tour-steps';

const mockT = (key: string) => key;

describe('tour-steps', () => {
  describe('constants', () => {
    it('getWelcomeTourSteps returns localized steps', () => {
      const steps = getWelcomeTourSteps(mockT);
      expect(steps.length).toBe(12);
      expect(steps[0]).toHaveProperty('title');
      expect(steps[0]).toHaveProperty('body');
      expect(steps[0].title).toBe('common.tour.welcome.1.title');
    });

    it('getWelcomeTourSteps returns 12 steps for US market', () => {
      const steps = getWelcomeTourSteps(mockT, 'US');
      expect(steps.length).toBe(12);
      const advancedStep = steps.find((s) => s.title === 'common.tour.welcome.6.title');
      expect(advancedStep?.body).toBe('common.tour.welcome.6.body.us');
      expect(advancedStep?.icon).toBe('🌐');
    });

    it('getWelcomeTourSteps uses BR advanced filters copy for BR market', () => {
      const steps = getWelcomeTourSteps(mockT, 'BR');
      const advancedStep = steps.find((s) => s.title === 'common.tour.welcome.6.title');
      expect(advancedStep?.body).toBe('common.tour.welcome.6.body.br');
      expect(advancedStep?.icon).toBe('🏷️');
    });

    it('getWelcomeTourSteps returns 12 steps for BR market', () => {
      const steps = getWelcomeTourSteps(mockT, 'BR');
      expect(steps.length).toBe(12);
    });

    it('getCheckoutCreditsTourSteps returns 3 steps', () => {
      const steps = getCheckoutCreditsTourSteps(mockT);
      expect(steps.length).toBe(3);
      expect(steps[1].target).toBe('header-credits');
      expect(steps[0].title).toBe('common.tour.checkout.1.title');
    });

    it('getTourStepsBySection has expected keys', () => {
      const sections = getTourStepsBySection(mockT);
      expect(sections).toHaveProperty('prospecao');
      expect(sections).toHaveProperty('inteligencia');
      expect(sections).toHaveProperty('equipe');
      expect(sections).toHaveProperty('conta');
    });

    it('storage keys are defined', () => {
      expect(TOUR_STORAGE_PREFIX).toBe('prospector_tour_');
      expect(WELCOME_TOUR_STORAGE_KEY).toBe('prospector_tour_welcome_done');
    });
  });

  describe('getSectionIdFromPath', () => {
    it('returns prospecao for /dashboard and /dashboard/', () => {
      expect(getSectionIdFromPath('/dashboard')).toBe('prospecao');
      expect(getSectionIdFromPath('/dashboard/')).toBe('prospecao');
    });

    it('returns prospecao for historico, leads, listas', () => {
      expect(getSectionIdFromPath('/dashboard/historico')).toBe('prospecao');
      expect(getSectionIdFromPath('/dashboard/leads')).toBe('prospecao');
      expect(getSectionIdFromPath('/dashboard/listas')).toBe('prospecao');
    });

    it('returns inteligencia for concorrencia, relatorios', () => {
      expect(getSectionIdFromPath('/dashboard/concorrencia')).toBe('inteligencia');
      expect(getSectionIdFromPath('/dashboard/relatorios')).toBe('inteligencia');
    });

    it('returns equipe for equipe path', () => {
      expect(getSectionIdFromPath('/dashboard/equipe')).toBe('equipe');
    });

    it('returns conta for perfil, planos, suporte', () => {
      expect(getSectionIdFromPath('/dashboard/perfil')).toBe('conta');
      expect(getSectionIdFromPath('/dashboard/planos')).toBe('conta');
      expect(getSectionIdFromPath('/dashboard/suporte')).toBe('conta');
    });

    it('returns null for unknown path', () => {
      expect(getSectionIdFromPath('/dashboard/unknown')).toBe(null);
    });
  });

  describe('getTourStorageKey', () => {
    it('prepends prefix to sectionId', () => {
      expect(getTourStorageKey('prospecao')).toBe('prospector_tour_prospecao');
    });
  });

  describe('localStorage helpers', () => {
    afterEach(() => {
      clearAllTourFlags();
    });

    it('wasTourSeen returns false when not set', () => {
      expect(wasTourSeen('prospecao')).toBe(false);
    });

    it('markTourSeen and wasTourSeen roundtrip', () => {
      markTourSeen('prospecao');
      expect(wasTourSeen('prospecao')).toBe(true);
    });

    it('wasWelcomeTourDone returns false when not set', () => {
      expect(wasWelcomeTourDone()).toBe(false);
    });

    it('markWelcomeTourDone and wasWelcomeTourDone roundtrip', () => {
      markWelcomeTourDone();
      expect(wasWelcomeTourDone()).toBe(true);
    });

    it('clearAllTourFlags removes tour keys', () => {
      markTourSeen('prospecao');
      markWelcomeTourDone();
      clearAllTourFlags();
      expect(wasTourSeen('prospecao')).toBe(false);
      expect(wasWelcomeTourDone()).toBe(false);
    });
  });
});
