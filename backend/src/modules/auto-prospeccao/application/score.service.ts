/**
 * calculatePropensityScore — pondera dados da empresa RF + análise IA
 * para gerar um score de 0-100 indicando propensão de conversão para a PrecisionAI.
 *
 * Pesos definidos com base nas características de empresas com maior probabilidade
 * de se beneficiar de uma ferramenta de prospecção com IA.
 */

import { HIGH_VALUE_CNAE_PREFIXES } from '../domain/types';
import type { RfCompanyData, AiAnalysisResult, ScoreResult } from '../domain/types';

const HIGH_VALUE_UFS = new Set(['SP', 'RJ', 'MG', 'DF', 'RS', 'PR', 'SC']);

// CNAEs de baixo valor relativo para prospecção (restaurantes, varejo simples, etc.)
const LOW_VALUE_CNAE_PREFIXES = ['5611', '5612', '4711', '4712', '4721', '4731', '4741'];

export function getSegment(cnaePrincipal: string): string | null {
  const code7 = cnaePrincipal.replace(/\D/g, '').substring(0, 7);
  const code4 = code7.substring(0, 4);

  const segmentMap: Record<string, string> = {
    '7020': 'consultorias',
    '7311': 'agencias',
    '7319': 'agencias',
    '6201': 'saas',
    '6202': 'saas',
    '6821': 'imobiliarias',
    '6920': 'contabilidade',
    '6622': 'seguros',
    '6630': 'financeiro',
    '6499': 'financeiro',
    '4671': 'distribuidoras',
    '4669': 'distribuidoras',
    '4665': 'distribuidoras',
    '8610': 'saude',
    '8621': 'saude',
    '8630': 'saude',
  };

  return segmentMap[code7] ?? segmentMap[code4] ?? null;
}

export function isHighValueCnae(cnaePrincipal: string): boolean {
  const code = cnaePrincipal.replace(/\D/g, '');
  return HIGH_VALUE_CNAE_PREFIXES.some(prefix => code.startsWith(prefix));
}

export function isLowValueCnae(cnaePrincipal: string): boolean {
  const code = cnaePrincipal.replace(/\D/g, '');
  return LOW_VALUE_CNAE_PREFIXES.some(prefix => code.startsWith(prefix));
}

function getCompanyAgeYears(dataAbertura?: string | null): number | null {
  if (!dataAbertura || dataAbertura.length < 8) return null;
  const year = parseInt(dataAbertura.substring(0, 4), 10);
  if (isNaN(year) || year < 1900) return null;
  return new Date().getFullYear() - year;
}

export function calculatePropensityScore(
  company: RfCompanyData,
  aiAnalysis?: AiAnalysisResult | null,
): ScoreResult {
  let score = 0;
  const factors: Record<string, number | boolean> = {};

  // ── Porte (max +20) ──────────────────────────────────────────
  if (company.porte === 'DEMAIS' || company.porte === '09') {
    score += 20;
    factors.porteGrande = true;
  } else if (company.porte === 'EPP' || company.porte === '05') {
    score += 12;
    factors.porteEpp = true;
  } else if (company.porte === 'ME' || company.porte === '03') {
    score += 5;
    factors.porteME = true;
  }

  // ── CNAE (max +15 / -10) ─────────────────────────────────────
  if (company.cnaePrincipal) {
    if (isHighValueCnae(company.cnaePrincipal)) {
      score += 15;
      factors.highValueCnae = true;
    } else if (isLowValueCnae(company.cnaePrincipal)) {
      score -= 10;
      factors.lowValueCnae = true;
    }
  }

  // ── Contato (max +15 / -10) ──────────────────────────────────
  const hasEmail = !!company.email?.trim();
  const hasPhone = !!(company.ddd?.trim() || company.telefone?.trim());

  if (hasEmail && hasPhone) {
    score += 15;
    factors.hasEmailAndPhone = true;
  } else if (hasEmail) {
    score += 7;
    factors.hasEmailOnly = true;
  } else {
    score -= 10;
    factors.noEmail = true;
  }

  // ── Capital Social (max +10) ─────────────────────────────────
  if (company.capitalSocial && company.capitalSocial >= 500000) {
    score += 10;
    factors.highCapital = true;
  } else if (company.capitalSocial && company.capitalSocial >= 100000) {
    score += 5;
    factors.mediumCapital = true;
  }

  // ── UF estratégica (max +5) ──────────────────────────────────
  if (company.uf && HIGH_VALUE_UFS.has(company.uf.toUpperCase())) {
    score += 5;
    factors.strategicUf = true;
  }

  // ── Idade da empresa (max +5) ────────────────────────────────
  const ageYears = getCompanyAgeYears(company.dataAbertura);
  if (ageYears !== null && ageYears >= 1 && ageYears <= 8) {
    score += 5;
    factors.youngCompany = true;
  }

  // ── Análise IA (max +15) ─────────────────────────────────────
  if (aiAnalysis) {
    if (aiAnalysis.score && aiAnalysis.score >= 70) {
      score += 10;
      factors.aiScoreHigh = true;
    } else if (aiAnalysis.score && aiAnalysis.score >= 50) {
      score += 5;
      factors.aiScoreMedium = true;
    }
    if (aiAnalysis.hasWebsite) {
      score += 5;
      factors.hasWebsite = true;
    }
  }

  // ── Clamp 0-100 ─────────────────────────────────────────────
  const finalScore = Math.max(0, Math.min(100, score));
  const segment = getSegment(company.cnaePrincipal ?? '');

  return { score: finalScore, total: finalScore, factors, breakdown: factors, segment };
}
