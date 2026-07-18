export interface AiAnalysisPreviewSource {
  painPoints?: unknown;
  summary?: string | null;
  approach?: string | null;
  firstContactMessage?: string | null;
  score?: number | null;
}

export function toPainPointsArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function getAiPainPreview(source: AiAnalysisPreviewSource): string | null {
  const pains = toPainPointsArray(source.painPoints);
  if (pains.length > 0) return pains[0] ?? null;
  const summary = source.summary?.trim();
  return summary || null;
}

export function getAiApproachPreview(source: AiAnalysisPreviewSource): string | null {
  const approach = source.approach?.trim();
  if (approach) return approach;
  const message = source.firstContactMessage?.trim();
  return message || null;
}

export function hasAiAnalysisPreview(source: AiAnalysisPreviewSource): boolean {
  if (source.score == null) return false;
  return getAiPainPreview(source) != null || getAiApproachPreview(source) != null;
}
