import { buildFallbackAnalysis, getAnalysisErrorMessage } from '@/lib/i18n/analysis-error-messages';

describe('analysis-error-messages', () => {
    it('returns English message for missing AI config', () => {
        expect(getAnalysisErrorMessage('no ai config for role', 'en')).toContain('AI is not configured');
    });

    it('returns Portuguese message for quota errors', () => {
        expect(getAnalysisErrorMessage('429 quota exceeded', 'pt')).toContain('Limite de uso');
    });

    it('builds English fallback analysis', () => {
        const result = buildFallbackAnalysis('Could not generate analysis', 'en');
        expect(result.scoreLabel).toBe('Unavailable');
        expect(result.approach).toBe('Check AI configuration in the admin panel.');
        expect(result.fullReport).toContain('# Error');
    });

    it('normalizes pt-BR to Portuguese messages', () => {
        const result = buildFallbackAnalysis('Falha', 'pt-BR');
        expect(result.scoreLabel).toBe('Indisponível');
    });

    it('returns English stale message for US market default', () => {
        const prev = process.env.MARKET;
        process.env.MARKET = 'US';
        expect(getAnalysisErrorMessage('timed out or interrupted', '')).toContain('took longer than expected');
        process.env.MARKET = prev;
    });

    it('classifies stale analysis errors', () => {
        expect(getAnalysisErrorMessage('analysis timed out', 'en')).toContain('took longer than expected');
        expect(getAnalysisErrorMessage('analysis timed out', 'pt')).toContain('demorou mais');
    });
});
