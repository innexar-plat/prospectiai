/**
 * Competitors module — domain types.
 */

import type { ScoredPlace } from '@/modules/scoring';

export type CompetitorPlace = {
  id: string;
  name: string;
  formattedAddress?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
};

export type AiPlaybook = {
  entryBarrier: 'alto' | 'medio' | 'baixo';
  entryBarrierExplanation: string;
  marketSummary: string;
  seoChecklist: string[];
  reviewStrategy: string[];
  quickWins: string[];
};

export type CompetitorAnalysisResult = {
  totalCount: number;
  rankingByRating: Array<{ position: number; id: string; name: string; rating: number; reviewCount?: number }>;
  rankingByReviews: Array<{ position: number; id: string; name: string; reviewCount: number; rating?: number }>;
  digitalPresence: {
    withWebsite: number;
    withoutWebsite: number;
    withPhone: number;
    withoutPhone: number;
  };
  opportunities: Array<{ id: string; name: string; missingWebsite: boolean; missingPhone: boolean }>;
  // Enhanced fields
  avgRating: number | null;
  medianReviews: number;
  topOpportunities: ScoredPlace[];
  aiPlaybook: AiPlaybook | null;
};
