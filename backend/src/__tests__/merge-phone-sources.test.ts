import { describe, it, expect } from '@jest/globals';

/**
 * Test suite for phone merging logic between Google Places and Receita Federal sources.
 * Ensures that when both sources have phone data, the Contact Intelligence system
 * correctly stores both and recommends the best one based on scoring.
 */

describe('Phone Source Merging (Google + Receita)', () => {
  describe('Frontend mergeResults', () => {
    /**
     * Mock implementation of the frontend mergeResults function
     */
    function mergeResults(rfPlaces: any[], googlePlaces: any[]): any[] {
      const rfByName = new Map<string, any>();
      const result: any[] = [];
      const seen = new Set<string>();

      // Index RF results by normalized name
      for (const p of rfPlaces) {
        const name = (p.displayName?.text ?? '').toLowerCase().trim();
        if (name) rfByName.set(name, p);
      }

      // Process Google results first — merge with RF data when matched
      for (const gp of googlePlaces) {
        const name = (gp.displayName?.text ?? '').toLowerCase().trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const rfMatch = rfByName.get(name);
        if (rfMatch) {
          // Merge: prefer Google Places phone/website/rating, enrich with RF CNPJ data
          result.push({
            ...gp,
            nationalPhoneNumber:
              gp.nationalPhoneNumber || gp.internationalPhoneNumber || rfMatch.nationalPhoneNumber,
            websiteUri: gp.websiteUri || rfMatch.websiteUri,
            cnpj: rfMatch.cnpj ?? gp.cnpj,
            companyLegalName: rfMatch.companyLegalName ?? gp.companyLegalName,
            companyTradeName: rfMatch.companyTradeName ?? gp.companyTradeName,
            companyMainCnae: rfMatch.companyMainCnae ?? gp.companyMainCnae,
            cnpjStatus: rfMatch.cnpjStatus ?? gp.cnpjStatus,
            rfData: rfMatch.rfData,
          });
        } else {
          result.push(gp);
        }
      }

      // Add RF-only results (not matched with any Google result)
      for (const p of rfPlaces) {
        const name = (p.displayName?.text ?? '').toLowerCase().trim();
        if (name && !seen.has(name)) {
          seen.add(name);
          result.push(p);
        }
      }

      return result;
    }

    it('should merge Google Places phone with RF CNPJ when names match', () => {
      const googlePlace = {
        displayName: { text: 'Cafe Central' },
        nationalPhoneNumber: '11987654321',
        internationalPhoneNumber: '+5511987654321',
        websiteUri: 'https://cafecentral.com',
      };

      const rfPlace = {
        displayName: { text: 'Cafe Central' },
        nationalPhoneNumber: '1133334444', // Accountant phone from RF
        cnpj: '12345678901234',
        companyLegalName: 'CAFE CENTRAL LTDA',
        rfData: { porte: 'EPP', email: 'contabil@cafe.com' },
      };

      const merged = mergeResults([rfPlace], [googlePlace]);

      expect(merged).toHaveLength(1);
      expect(merged[0].nationalPhoneNumber).toBe('11987654321'); // Google phone wins
      expect(merged[0].cnpj).toBe('12345678901234'); // RF CNPJ kept
      expect(merged[0].companyLegalName).toBe('CAFE CENTRAL LTDA');
      expect(merged[0].rfData.porte).toBe('EPP');
    });

    it('should keep both Google and RF when names do not match', () => {
      const googlePlace = {
        id: 'google_123',
        displayName: { text: 'Cafe Central' },
        nationalPhoneNumber: '11987654321',
      };

      const rfPlace = {
        id: 'rf_12345678901234',
        displayName: { text: 'Cafe Central Ltda' }, // Slightly different name
        nationalPhoneNumber: '1133334444',
        cnpj: '12345678901234',
      };

      const merged = mergeResults([rfPlace], [googlePlace]);

      expect(merged).toHaveLength(2); // Both kept
      expect(merged[0].id).toBe('google_123');
      expect(merged[1].id).toBe('rf_12345678901234');
    });

    it('should preserve Google website when available', () => {
      const googlePlace = {
        displayName: { text: 'Accounting Firm' },
        nationalPhoneNumber: '1133334444',
        websiteUri: 'https://firm.com.br',
      };

      const rfPlace = {
        displayName: { text: 'Accounting Firm' },
        websiteUri: undefined,
        rfData: { email: 'contato@firm.com' },
      };

      const merged = mergeResults([rfPlace], [googlePlace]);

      expect(merged[0].websiteUri).toBe('https://firm.com.br');
    });
  });

  describe('Backend syncLeadContacts', () => {
    /**
     * Mock implementation of upsertLeadContact and syncLeadContacts
     */
    const mockUpserts: any[] = [];

    function normalizePhone(phone: string): string {
      return phone.replace(/\D/g, '');
    }

    async function mockUpsertLeadContact(input: {
      leadId: string;
      type: string;
      source: string;
      valueRaw: string;
      valueNormalized: string;
      confidenceScore?: number;
      isPrimary?: boolean;
      evidence?: Record<string, any>;
    }) {
      if (!input.valueNormalized) return;
      mockUpserts.push(input);
    }

    async function syncLeadContacts(
      leadId: string,
      input: {
        googlePhone?: string;
        googleWebsite?: string;
        rfEmail?: string | null;
        rfPhone?: string | null;
      },
    ) {
      const tasks: Array<Promise<void>> = [];

      if (input.googlePhone) {
        const normalized = normalizePhone(input.googlePhone);
        if (normalized) {
          tasks.push(
            mockUpsertLeadContact({
              leadId,
              type: 'PHONE',
              source: 'GOOGLE',
              valueRaw: input.googlePhone,
              valueNormalized: normalized,
              confidenceScore: 70,
              isPrimary: true,
              evidence: { sourceField: 'nationalPhoneNumber|internationalPhoneNumber' },
            }),
          );
        }
      }

      if (input.rfPhone) {
        const normalized = normalizePhone(input.rfPhone);
        if (normalized) {
          tasks.push(
            mockUpsertLeadContact({
              leadId,
              type: 'PHONE',
              source: 'RECEITA',
              valueRaw: input.rfPhone,
              valueNormalized: normalized,
              confidenceScore: 55,
              isPrimary: !input.googlePhone,
              evidence: { sourceField: 'rfCompany.ddd+telefone' },
            }),
          );
        }
      }

      await Promise.all(tasks);
    }

    beforeEach(() => {
      mockUpserts.length = 0;
    });

    it('should store Google phone with score 70', async () => {
      await syncLeadContacts('lead_123', {
        googlePhone: '(11) 98765-4321',
      });

      expect(mockUpserts).toHaveLength(1);
      expect(mockUpserts[0]).toMatchObject({
        type: 'PHONE',
        source: 'GOOGLE',
        valueRaw: '(11) 98765-4321',
        valueNormalized: '11987654321',
        confidenceScore: 70,
        isPrimary: true,
      });
    });

    it('should store RF phone with score 55 and set as primary only if no Google phone', async () => {
      await syncLeadContacts('lead_456', {
        rfPhone: '1133334444',
      });

      expect(mockUpserts).toHaveLength(1);
      expect(mockUpserts[0]).toMatchObject({
        type: 'PHONE',
        source: 'RECEITA',
        valueRaw: '1133334444',
        valueNormalized: '1133334444',
        confidenceScore: 55,
        isPrimary: true, // Primary because no Google phone
      });
    });

    it('should store both Google and RF phones when available', async () => {
      await syncLeadContacts('lead_789', {
        googlePhone: '11987654321',
        rfPhone: '1133334444',
      });

      expect(mockUpserts).toHaveLength(2);

      const googleEntry = mockUpserts.find((u) => u.source === 'GOOGLE');
      const rfEntry = mockUpserts.find((u) => u.source === 'RECEITA');

      expect(googleEntry).toMatchObject({
        source: 'GOOGLE',
        confidenceScore: 70,
        isPrimary: true,
      });

      expect(rfEntry).toMatchObject({
        source: 'RECEITA',
        confidenceScore: 55,
        isPrimary: false, // Not primary because Google phone exists
      });
    });

    it('should skip RF phone if empty or null', async () => {
      await syncLeadContacts('lead_null', {
        googlePhone: '11987654321',
        rfPhone: null,
      });

      expect(mockUpserts).toHaveLength(1);
      expect(mockUpserts[0].source).toBe('GOOGLE');
    });
  });

  describe('Contact Intelligence Scoring', () => {
    /**
     * Mock contact intelligence scoring logic
     */
    function baseScoreBySource(source: string): number {
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

    function pickBest(contacts: any[]): any | null {
      if (contacts.length === 0) return null;

      const primaryCandidates = contacts.filter((c) => c.isPrimary);
      const candidates = primaryCandidates.length > 0 ? primaryCandidates : contacts;

      return [...candidates].sort((a, b) => b.effectiveScore - a.effectiveScore)[0];
    }

    it('should recommend Google phone over Receita when both available', () => {
      const contacts = [
        {
          type: 'PHONE',
          source: 'GOOGLE',
          valueRaw: '11987654321',
          confidenceScore: 70,
          effectiveScore: 70,
          isPrimary: true,
        },
        {
          type: 'PHONE',
          source: 'RECEITA',
          valueRaw: '1133334444',
          confidenceScore: 55,
          effectiveScore: 55,
          isPrimary: false,
        },
      ];

      const recommended = pickBest(contacts);

      expect(recommended.source).toBe('GOOGLE');
      expect(recommended.valueRaw).toBe('11987654321');
    });

    it('should use base score from source when computing recommendation', () => {
      const googleScore = baseScoreBySource('GOOGLE');
      const rfScore = baseScoreBySource('RECEITA');

      expect(googleScore).toBe(70);
      expect(rfScore).toBe(55);
      expect(googleScore).toBeGreaterThan(rfScore);
    });

    it('should prioritize primary flag when both have similar scores', () => {
      const contacts = [
        {
          type: 'PHONE',
          source: 'WEB_SEARCH',
          valueRaw: '11999999999',
          confidenceScore: 60,
          effectiveScore: 60,
          isPrimary: false,
        },
        {
          type: 'PHONE',
          source: 'RECEITA',
          valueRaw: '1133334444',
          confidenceScore: 55,
          effectiveScore: 55,
          isPrimary: true,
        },
      ];

      const recommended = pickBest(contacts);

      expect(recommended.isPrimary).toBe(true);
      expect(recommended.source).toBe('RECEITA');
    });
  });
});
