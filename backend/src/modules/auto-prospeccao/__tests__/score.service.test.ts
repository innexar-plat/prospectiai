import { calculatePropensityScore, getSegment, isHighValueCnae } from '../application/score.service';
import type { RfCompanyData, AiAnalysisResult } from '../domain/types';

const baseCompany: RfCompanyData = {
  cnpj: '12345678000190',
  razaoSocial: 'EMPRESA TESTE LTDA',
  cnaePrincipal: '7020400', // consultoria
  uf: 'SP',
  municipio: 'São Paulo',
  porte: 'DEMAIS',
  capitalSocial: 600000,
  dataAbertura: '20180101',
  telefone: '912345678',
  ddd: '11',
  email: 'contato@empresa.com',
};

describe('calculatePropensityScore', () => {
  it('should return a score for a typical company', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('should award porte DEMAIS +20 points', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.porteGrande).toBe(true);
  });

  it('should award +15 for high-value CNAE', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.highValueCnae).toBe(true);
  });

  it('should award +15 for having email and phone', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.hasEmailAndPhone).toBe(true);
  });

  it('should penalize -10 for no email', () => {
    const noEmail = { ...baseCompany, email: undefined };
    const result = calculatePropensityScore(noEmail);
    expect(result.breakdown.noEmail).toBe(true);
  });

  it('should award +10 for capital > 500k', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.highCapital).toBe(true);
  });

  it('should award +5 for strategic UF (SP)', () => {
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.strategicUf).toBe(true);
  });

  it('should award +5 for young company (1-8 years)', () => {
    // Company opened in 2018, roughly 6-7 years old
    const result = calculatePropensityScore(baseCompany);
    expect(result.breakdown.youngCompany).toBe(true);
  });

  it('should apply AI score bonus when aiScore >= 70', () => {
    const aiResult: AiAnalysisResult = {
      score: 80,
      summary: 'Great company',
      strengths: [],
      concerns: [],
    };
    const withAi = calculatePropensityScore(baseCompany, aiResult);
    const withoutAi = calculatePropensityScore(baseCompany);
    expect(withAi.total - withoutAi.total).toBe(10);
  });

  it('should apply AI score bonus when aiScore >= 50', () => {
    const aiResult: AiAnalysisResult = {
      score: 60,
      summary: 'Good company',
      strengths: [],
      concerns: [],
    };
    const withAi = calculatePropensityScore(baseCompany, aiResult);
    const withoutAi = calculatePropensityScore(baseCompany);
    expect(withAi.total - withoutAi.total).toBe(5);
  });

  it('should clamp score between 0 and 100', () => {
    const worstCompany: RfCompanyData = {
      cnpj: '99999999000199',
      razaoSocial: 'PIOR EMPRESA',
      cnaePrincipal: '0111300', // agricultura - low value
      uf: 'AC',
      municipio: 'Cruzeiro do Sul',
      porte: 'ME',
      capitalSocial: 1000,
      dataAbertura: '20000101',
    };
    const result = calculatePropensityScore(worstCompany);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('should give EPP companies +12', () => {
    const epp = { ...baseCompany, porte: 'EPP' };
    const result = calculatePropensityScore(epp);
    expect(result.breakdown.porteEpp).toBe(true);
  });

  it('should give ME companies +5', () => {
    const me = { ...baseCompany, porte: 'ME' };
    const result = calculatePropensityScore(me);
    expect(result.breakdown.porteME).toBe(true);
  });
});

describe('getSegment', () => {
  it('should return segment for a known CNAE', () => {
    const segment = getSegment('7020400');
    expect(segment).not.toBeNull();
  });

  it('should return null for unknown CNAE', () => {
    const segment = getSegment('0000000');
    expect(segment).toBeNull();
  });
});

describe('isHighValueCnae', () => {
  it('should identify CNAE 7020 (consultoria) as high value', () => {
    expect(isHighValueCnae('7020400')).toBe(true);
  });

  it('should not identify CNAE 0111 (agriculture) as high value', () => {
    expect(isHighValueCnae('0111300')).toBe(false);
  });
});
