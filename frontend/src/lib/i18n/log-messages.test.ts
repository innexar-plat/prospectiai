import { describe, it, expect } from 'vitest';
import { getLogMessage, getAnalyzeStepLabel } from '@/lib/i18n/log-messages';

describe('log-messages', () => {
    it('returns English AI config message for en locale', () => {
        expect(getLogMessage('log.ai.checkAdminConfig', 'en')).toBe('Check AI configuration in the admin panel.');
    });

    it('returns Spanish analysis failed message', () => {
        expect(getLogMessage('log.ai.analysisFailed', 'es')).toContain('análisis detallado');
    });

    it('normalizes BCP-47 locale tags', () => {
        expect(getLogMessage('log.ai.errorTitle', 'en-US')).toBe('Error');
    });

    it('returns analyze step label for profile in English', () => {
        expect(getAnalyzeStepLabel('profile', 'en')).toBe('Loading business profile...');
    });

    it('falls back to Portuguese for unknown locale', () => {
        expect(getLogMessage('log.analyze.error.timeout', 'fr')).toContain('Tempo limite');
    });
});
