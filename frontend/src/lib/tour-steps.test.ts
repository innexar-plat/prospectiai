import { describe, it, expect, afterEach } from 'vitest';
import {
  WELCOME_TOUR_STEPS,
  TOUR_STEPS_BY_SECTION,
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

describe('tour-steps', () => {
  describe('constants', () => {
    it('WELCOME_TOUR_STEPS has steps', () => {
      expect(WELCOME_TOUR_STEPS.length).toBeGreaterThan(0);
      expect(WELCOME_TOUR_STEPS[0]).toHaveProperty('title');
      expect(WELCOME_TOUR_STEPS[0]).toHaveProperty('body');
    });

    it('TOUR_STEPS_BY_SECTION has expected keys', () => {
      expect(TOUR_STEPS_BY_SECTION).toHaveProperty('prospecao');
      expect(TOUR_STEPS_BY_SECTION).toHaveProperty('inteligencia');
      expect(TOUR_STEPS_BY_SECTION).toHaveProperty('equipe');
      expect(TOUR_STEPS_BY_SECTION).toHaveProperty('conta');
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
