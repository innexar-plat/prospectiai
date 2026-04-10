/**
 * Zod schemas for AI-generated structured data.
 *
 * Used with AI SDK `generateObject()` for type-safe, validated responses.
 * Each schema mirrors the corresponding TypeScript interface in gemini.ts.
 */

import { z } from 'zod';

export const leadAnalysisSchema = z.object({
    score: z.number().min(0).max(100).describe('Lead score 0-100'),
    scoreLabel: z.string().describe('Cold|Warm|Hot|Very Hot'),
    summary: z.string().describe('Executive summary specific to this business'),
    strengths: z.array(z.string()).describe('Specific strengths'),
    weaknesses: z.array(z.string()).describe('Specific weaknesses'),
    painPoints: z.array(z.string()).describe('Customer pain points'),
    gaps: z.array(z.string()).describe('Gaps and opportunities'),
    approach: z.string().describe('Specific approach strategy'),
    contactStrategy: z.string().describe('Recommended contact channels and timing'),
    firstContactMessage: z.string().describe('Professional first contact message'),
    suggestedWhatsAppMessage: z.string().describe('Casual WhatsApp message'),
    reviewAnalysis: z.string().optional().describe('Analysis of rating trend and recency'),
    reviewTrend: z.string().optional().describe('Growing|Stable|Declining'),
    suggestedContactTime: z.string().optional().describe('Best contact time window'),
    socialMedia: z.object({
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        linkedin: z.string().optional(),
    }).optional().describe('Real social media URLs only — never hallucinate'),
    fullReport: z.string().describe('Detailed Markdown report (2000+ words)'),
    reclameAquiAnalysis: z.string().optional().describe('Reclame Aqui reputation analysis'),
    jusBrasilAnalysis: z.string().optional().describe('JusBrasil legal analysis'),
    cnpjAnalysis: z.string().optional().describe('CNPJ data analysis'),
    closeProbability: z.number().min(0).max(100).optional().describe('Predicted close probability'),
    estimatedDealValue: z.number().optional().describe('Estimated deal value in BRL'),
    bestContactWindow: z.string().optional().describe('Best day/time for contact'),
});

export type LeadAnalysisSchema = z.infer<typeof leadAnalysisSchema>;
