import { describe, it, expect } from 'vitest';
import {
  getAiApproachPreview,
  getAiPainPreview,
  hasAiAnalysisPreview,
  toPainPointsArray,
} from './analysis-preview';

describe('analysis-preview', () => {
  it('prefers first pain point over summary', () => {
    expect(getAiPainPreview({
      painPoints: ['Slow support', 'High prices'],
      summary: 'Generic summary',
    })).toBe('Slow support');
  });

  it('falls back to summary when pain points are empty', () => {
    expect(getAiPainPreview({ painPoints: [], summary: '  Summary text  ' })).toBe('Summary text');
  });

  it('prefers approach over first contact message', () => {
    expect(getAiApproachPreview({
      approach: 'Lead with ROI',
      firstContactMessage: 'Hello there',
    })).toBe('Lead with ROI');
  });

  it('falls back to first contact message', () => {
    expect(getAiApproachPreview({ firstContactMessage: 'Hi, I noticed...' })).toBe('Hi, I noticed...');
  });

  it('detects preview only when score exists', () => {
    expect(hasAiAnalysisPreview({ score: 8, summary: 'Pain summary' })).toBe(true);
    expect(hasAiAnalysisPreview({ summary: 'Pain summary' })).toBe(false);
  });

  it('normalizes invalid pain points', () => {
    expect(toPainPointsArray([' valid ', '', 42])).toEqual([' valid ']);
  });
});
