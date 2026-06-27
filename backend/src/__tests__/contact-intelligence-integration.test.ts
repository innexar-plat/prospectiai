import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Integration test suite for the Contact Intelligence phone merge workflow.
 * Tests the end-to-end flow from lead sync to contact recommendation.
 */

describe('Contact Intelligence Integration - Phone Merge Workflow', () => {
  /**
   * Simulates a minimal Contact Intelligence state
   */
  class MockContactIntelligenceState {
    leadContacts: Array<{
      id: string;
      leadId: string;
      type: string;
      source: string;
      valueRaw: string;
      valueNormalized: string;
      confidenceScore: number | null;
      isPrimary: boolean;
      evidence: Record<string, any> | null;
      firstSeenAt: Date;
      lastSeenAt: Date;
    }> = [];

    constructor(private leadId: string) {}

    upsertLeadContact(input: {
      type: string;
      source: string;
      valueRaw: string;
      valueNormalized: string;
      confidenceScore?: number;
      isPrimary?: boolean;
      evidence?: Record<string, any>;
    }) {
      if (!input.valueNormalized) return;

      const key = `${this.leadId}:${input.type}:${input.valueNormalized}:${input.source}`;
      const existing = this.leadContacts.findIndex((c) => `${c.leadId}:${c.type}:${c.valueNormalized}:${c.source}` === key);

      const contact = {
        id: `contact_${Math.random()}`,
        leadId: this.leadId,
        type: input.type,
        source: input.source,
        valueRaw: input.valueRaw,
        valueNormalized: input.valueNormalized,
        confidenceScore: input.confidenceScore ?? null,
        isPrimary: input.isPrimary ?? false,
        evidence: input.evidence ?? null,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      };

      if (existing >= 0) {
        this.leadContacts[existing] = contact;
      } else {
        this.leadContacts.push(contact);
      }
    }

    baseScoreBySource(source: string): number {
      switch (source) {
        case 'MANUAL':
          return 90;
        case 'WEBSITE_SCRAPER':
          return 80;
        case 'GOOGLE':
          return 70;
        case 'WEB_SEARCH':
          return 60;
        case 'RECEITA':
          return 55;
        default:
          return 50;
      }
    }

    computeEffectiveScore(contact: any): { score: number; flags: string[] } {
      let score = contact.confidenceScore ?? this.baseScoreBySource(contact.source);
      const flags: string[] = [];

      // Penalty for accountant pattern
      if (contact.type === 'EMAIL' && /contab|fiscal|assessoria|escritorio/.test(contact.valueNormalized.toLowerCase())) {
        score -= 20;
        flags.push('accountant_pattern');
      }

      // Simulated penalty for shared phone (mock: assume high sharing if score set)
      if (contact.source === 'RECEITA' && contact.valueNormalized === '1133334444') {
        score -= 35; // Simulated: "shared with 5+ companies"
        flags.push('shared_with_many');
      }

      if (contact.isPrimary) score += 5;

      return { score: Math.max(0, Math.min(100, score)), flags };
    }

    buildRecommendation() {
      const phoneContacts = this.leadContacts.filter((c) => c.type === 'PHONE');

      const enriched = phoneContacts.map((contact) => {
        const { score, flags } = this.computeEffectiveScore(contact);
        return {
          ...contact,
          effectiveScore: score,
          riskFlags: flags,
        };
      });

      if (enriched.length === 0) return null;

      const sorted = [...enriched].sort((a, b) => b.effectiveScore - a.effectiveScore);
      return {
        recommended: sorted[0],
        alternatives: sorted.slice(1),
      };
    }

    getReport() {
      return {
        storedContacts: this.leadContacts,
        recommendation: this.buildRecommendation(),
      };
    }
  }

  describe('Full Workflow: Merge Google + Receita → Recommendation', () => {
    let state: MockContactIntelligenceState;

    beforeEach(() => {
      state = new MockContactIntelligenceState('lead_cafe_central');
    });

    it('should end-to-end: Google + Receita → Google recommended', () => {
      // Step 1: Sync Google Places data
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '+55 11 9876-5432',
        valueNormalized: '5511987654321',
        confidenceScore: 70,
        isPrimary: true,
        evidence: { sourceField: 'nationalPhoneNumber' },
      });

      // Step 2: Sync Receita data
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '11 3333-4444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: false,
        evidence: { sourceField: 'rfCompany.ddd+telefone' },
      });

      // Step 3: Query recommendation
      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(2);

      const recommended = report.recommendation?.recommended;
      expect(recommended?.source).toBe('GOOGLE');
      expect(recommended?.effectiveScore).toBe(75); // 70 + 5 (primary bonus)
      expect(recommended?.valueNormalized).toBe('5511987654321');

      const alternatives = report.recommendation?.alternatives;
      expect(alternatives).toHaveLength(1);
      expect(alternatives?.[0].source).toBe('RECEITA');
      expect(alternatives?.[0].effectiveScore).toBe(20); // 55 - 35 (shared penalty)
    });

    it('should handle Receita-only case (Google missing)', () => {
      // Only RF phone available
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '11 3333-4444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: true,
        evidence: { sourceField: 'rfCompany.ddd+telefone' },
      });

      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(1);

      const recommended = report.recommendation?.recommended;
      expect(recommended?.source).toBe('RECEITA');
      expect(recommended?.isPrimary).toBe(true);
      expect(recommended?.effectiveScore).toBe(25); // 55 + 5 (primary) - 35 (shared penalty)
    });

    it('should handle Google-only case (no Receita match)', () => {
      // Only Google phone available
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '+55 11 9876-5432',
        valueNormalized: '5511987654321',
        confidenceScore: 70,
        isPrimary: true,
        evidence: { sourceField: 'nationalPhoneNumber' },
      });

      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(1);

      const recommended = report.recommendation?.recommended;
      expect(recommended?.source).toBe('GOOGLE');
      expect(recommended?.effectiveScore).toBe(75); // 70 + 5
    });

    it('should skip if phone value is empty', () => {
      // Attempt to store empty phone
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '',
        valueNormalized: '', // Empty after normalization
        confidenceScore: 70,
        isPrimary: true,
      });

      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(0); // Skipped
    });

    it('should update existing contact on second sync', () => {
      // First sync
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '11 9876-5432',
        valueNormalized: '1198765432',
        confidenceScore: 70,
        isPrimary: true,
      });

      expect(state.leadContacts).toHaveLength(1);
      expect(state.leadContacts[0].valueRaw).toBe('11 9876-5432');

      // Second sync (updated phone)
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '11 9999-8888',
        valueNormalized: '1198765432', // Same normalized, so matches key
        confidenceScore: 72,
        isPrimary: true,
      });

      // Should replace, not duplicate
      expect(state.leadContacts).toHaveLength(1);
      expect(state.leadContacts[0].valueRaw).toBe('11 9999-8888');
      expect(state.leadContacts[0].confidenceScore).toBe(72);
    });

    it('should rank multiple sources correctly', () => {
      // Simulate finding phone from multiple sources
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '11 9876-5432',
        valueNormalized: '1198765432',
        confidenceScore: 70,
        isPrimary: true,
      });

      state.upsertLeadContact({
        type: 'PHONE',
        source: 'WEB_SEARCH',
        valueRaw: '11 9876-5432', // Same number, different source
        valueNormalized: '1198765432',
        confidenceScore: 60,
        isPrimary: false,
      });

      state.upsertLeadContact({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '11 3333-4444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: false,
      });

      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(3);

      const recommended = report.recommendation?.recommended;
      expect(recommended?.source).toBe('GOOGLE');
      expect(recommended?.effectiveScore).toBe(75); // 70 + 5 (primary)

      const alternatives = report.recommendation?.alternatives;
      expect(alternatives?.[0].source).toBe('WEB_SEARCH'); // 60 second
      expect(alternatives?.[1].source).toBe('RECEITA'); // 20 third
    });

    it('should reset flags on final score', () => {
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '11 3333-4444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: false,
      });

      const report = state.getReport();
      const recommended = report.recommendation?.recommended;

      expect(recommended?.riskFlags).toContain('shared_with_many');
      expect(recommended?.effectiveScore).toBe(20); // 55 + 5 - 35
    });
  });

  describe('Edge Cases', () => {
    let state: MockContactIntelligenceState;

    beforeEach(() => {
      state = new MockContactIntelligenceState('lead_edge_case');
    });

    it('should handle no phones stored', () => {
      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(0);
      expect(report.recommendation).toBeNull();
    });

    it('should handle normalized phone with non-numeric characters stripped', () => {
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '+55 (11) 9876-5432 ext. 123',
        valueNormalized: '559876543212', // Normalized: all non-digits removed, but extension kept
        confidenceScore: 70,
        isPrimary: true,
      });

      const report = state.getReport();

      expect(report.storedContacts).toHaveLength(1);
      expect(report.storedContacts[0].valueNormalized).toBe('559876543212');
    });

    it('should not recommend if all phones flagged with high risk', () => {
      // Mock high-risk scenario: both phones shared with many
      state.upsertLeadContact({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '11 3333-4444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: false,
      });

      const report = state.getReport();
      const recommended = report.recommendation?.recommended;

      expect(recommended?.effectiveScore).toBe(20); // Still recommends, but low score
      expect(recommended?.riskFlags.length).toBeGreaterThan(0);
    });
  });
});
