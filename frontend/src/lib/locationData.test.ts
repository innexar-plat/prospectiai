import { describe, it, expect } from 'vitest';
import { getStatesByCountry, getCountryLabel, normalizeCountryCode, getStateLabel, getSearchCountries, BR_STATES, US_STATES, COUNTRIES } from './locationData';

describe('locationData', () => {
  describe('getStatesByCountry', () => {
    it('returns BR_STATES for BR', () => {
      expect(getStatesByCountry('BR')).toEqual(BR_STATES);
    });

    it('returns US_STATES for US', () => {
      const states = getStatesByCountry('US');
      expect(states[0]).toEqual({ value: 'Todos', label: 'All states' });
      expect(states).toHaveLength(52);
      expect(states).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'CA' }),
        expect.objectContaining({ value: 'NY' }),
        expect.objectContaining({ value: 'TX' }),
        expect.objectContaining({ value: 'DC' }),
      ]));
      expect(states).toEqual(US_STATES);
    });

    it('returns mapped states for non-BR countries', () => {
      const arStates = getStatesByCountry('AR');
      expect(arStates[0]).toEqual({ value: 'Todos', label: 'Todas las provincias' });
      expect(arStates.length).toBeGreaterThan(1);
    });
  });

  describe('normalizeCountryCode', () => {
    it('uppercases valid ISO codes', () => {
      expect(normalizeCountryCode('us')).toBe('US');
      expect(normalizeCountryCode(' br ')).toBe('BR');
    });

    it('maps common US aliases', () => {
      expect(normalizeCountryCode('usa')).toBe('US');
      expect(normalizeCountryCode('United States')).toBe('US');
    });
  });

  describe('getStateLabel', () => {
    it('returns UF abbreviation for BR states', () => {
      expect(getStateLabel('BR', 'SP')).toBe('SP');
    });

    it('returns full name for US states', () => {
      expect(getStateLabel('US', 'FL')).toBe('Florida');
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
      expect(COUNTRIES[0]).toEqual({ value: 'BR', label: 'Brasil', queryLabel: 'Brasil', flag: '🇧🇷' });
    });

    it('BR_STATES includes Todos and UFs', () => {
      expect(BR_STATES[0]).toEqual({ value: 'Todos', label: 'Todos os estados' });
      expect(BR_STATES).toEqual(expect.arrayContaining([
        expect.objectContaining({ value: 'SP' }),
        expect.objectContaining({ value: 'RJ' }),
      ]));
    });
  });

  describe('getSearchCountries', () => {
    it('returns all countries in BR market', () => {
      expect(getSearchCountries('BR')).toEqual(COUNTRIES);
    });

    it('returns only US in US market', () => {
      expect(getSearchCountries('US')).toEqual([COUNTRIES.find((c) => c.value === 'US')]);
    });
  });
});
