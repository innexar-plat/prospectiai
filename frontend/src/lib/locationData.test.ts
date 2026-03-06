import { describe, it, expect } from 'vitest';
import { getStatesByCountry, getCountryLabel, BR_STATES, COUNTRIES } from './locationData';

describe('locationData', () => {
  describe('getStatesByCountry', () => {
    it('returns BR_STATES for BR', () => {
      expect(getStatesByCountry('BR')).toEqual(BR_STATES);
    });

    it('returns ["Todos"] for non-BR', () => {
      expect(getStatesByCountry('AR')).toEqual(['Todos']);
      expect(getStatesByCountry('US')).toEqual(['Todos']);
    });
  });

  describe('getCountryLabel', () => {
    it('returns label for known country code', () => {
      expect(getCountryLabel('BR')).toBe('Brasil');
      expect(getCountryLabel('US')).toBe('Estados Unidos');
    });

    it('returns code when not found', () => {
      expect(getCountryLabel('XX')).toBe('XX');
    });
  });

  describe('constants', () => {
    it('COUNTRIES has expected shape', () => {
      expect(COUNTRIES.length).toBeGreaterThan(0);
      expect(COUNTRIES[0]).toEqual({ value: 'BR', label: 'Brasil', flag: '🇧🇷' });
    });

    it('BR_STATES includes Todos and UFs', () => {
      expect(BR_STATES[0]).toBe('Todos');
      expect(BR_STATES).toContain('SP');
      expect(BR_STATES).toContain('RJ');
    });
  });
});
