import { describe, expect, it } from 'vitest';
import { getRealNameValidationMessage, isLikelyRealPersonName, normalizePersonName } from './realName';

describe('realName', () => {
    it('normalizes extra whitespace', () => {
        expect(normalizePersonName('  Maria   de   Souza  ')).toBe('Maria de Souza');
    });

    it('accepts common real names in Portuguese', () => {
        expect(isLikelyRealPersonName('Maria de Souza')).toBe(true);
        expect(isLikelyRealPersonName("Joao D'Avila")).toBe(true);
        expect(isLikelyRealPersonName('Ana Luiza')).toBe(true);
    });

    it('rejects nickname-style or malformed names', () => {
        expect(isLikelyRealPersonName('46jhon_zx')).toBe(false);
        expect(isLikelyRealPersonName('Jhon123 Silva')).toBe(false);
        expect(isLikelyRealPersonName('Jhon')).toBe(false);
    });

    it('returns a helpful validation message for invalid names', () => {
        expect(getRealNameValidationMessage('46jhon_zx')).toMatch(/nome e sobrenome reais/i);
    });
});