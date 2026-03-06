import { describe, it, expect } from 'vitest';
import { PLACE_TYPE_CATEGORIES, getPlaceTypeByValue } from './placeTypes';

describe('placeTypes', () => {
  describe('PLACE_TYPE_CATEGORIES', () => {
    it('has categories with label and types', () => {
      expect(PLACE_TYPE_CATEGORIES.length).toBeGreaterThan(0);
      expect(PLACE_TYPE_CATEGORIES[0]).toHaveProperty('label');
      expect(PLACE_TYPE_CATEGORIES[0].types.length).toBeGreaterThan(0);
      expect(PLACE_TYPE_CATEGORIES[0].types[0]).toEqual({ value: expect.any(String), label: expect.any(String) });
    });
  });

  describe('getPlaceTypeByValue', () => {
    it('returns option when value exists', () => {
      const opt = getPlaceTypeByValue('lawyer');
      expect(opt).toEqual({ value: 'lawyer', label: 'Advogado' });
    });

    it('returns undefined when value does not exist', () => {
      expect(getPlaceTypeByValue('nonexistent')).toBeUndefined();
    });
  });
});
