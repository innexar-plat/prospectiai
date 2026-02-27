/** Market module — domain types */

import type { ScoredPlace } from '@/modules/scoring';

export type MarketSegment = {
  type: string;
  count: number;
  avgRating: number | null;
};

export type AiMarketInsights = {
  executiveSummary: string;
  marketTrends: string[];
  opportunities: string[];
  recommendations: string[];
};

export type MarketReportResult = {
  totalBusinesses: number;
  segments: MarketSegment[];
  digitalMaturity: {
    withWebsite: number;
    withPhone: number;
    total: number;
    withWebsitePercent: number;
    withPhonePercent: number;
  };
  saturationIndex: number;
  // Enhanced fields
  avgRating: number | null;
  topOpportunities: ScoredPlace[];
  aiInsights: AiMarketInsights | null;
};
