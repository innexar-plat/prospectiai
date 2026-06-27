import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────

export const ProspectedLeadStatus = {
  NEW: 'NEW',
  ANALYZING: 'ANALYZING',
  SCORED: 'SCORED',
  COLD: 'COLD',
  WARM: 'WARM',
  HOT: 'HOT',
  EMAILING: 'EMAILING',
  CRM_SENT: 'CRM_SENT',
  ENGAGED: 'ENGAGED',
  CONVERTED: 'CONVERTED',
  BOUNCED: 'BOUNCED',
  OPTED_OUT: 'OPTED_OUT',
} as const;
export type ProspectedLeadStatusType = keyof typeof ProspectedLeadStatus;

export const AutoProspRunStatus = {
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const AutoProspTemplateType = {
  HOT_COLD_INTRO: 'HOT_COLD_INTRO',
  HOT_FOLLOW_NO_OPEN: 'HOT_FOLLOW_NO_OPEN',
  HOT_FOLLOW_OPENED: 'HOT_FOLLOW_OPENED',
  HOT_LAST_ATTEMPT: 'HOT_LAST_ATTEMPT',
  WARM_WEEK1_EDUCATION: 'WARM_WEEK1_EDUCATION',
  WARM_WEEK2_VALUE: 'WARM_WEEK2_VALUE',
  WARM_WEEK3_SOCIAL: 'WARM_WEEK3_SOCIAL',
  WARM_WEEK4_OFFER: 'WARM_WEEK4_OFFER',
  CUSTOM: 'CUSTOM',
} as const;

// Segmentos semânticos mapeados de grupos de CNAE
export const CNAE_SEGMENT_MAP: Record<string, string> = {
  '7020': 'consultorias',
  '7311': 'agencias',
  '7319': 'agencias',
  '6201': 'saas',
  '6202': 'saas',
  '6821': 'imobiliarias',
  '6920': 'contabilidade',
  '6622': 'seguros',
  '7020400': 'consultorias',
  '7311400': 'agencias',
  '6201500': 'saas',
  '6202300': 'saas',
  '6821800': 'imobiliarias',
  '6920600': 'contabilidade',
  '6622300': 'seguros',
};

// CNAEs de alto valor para scoring
export const HIGH_VALUE_CNAE_PREFIXES = ['7020', '7311', '7319', '6201', '6202', '6821', '6920', '6622'];

// ── Schemas de Validação ──────────────────────────────────────

export const configSchema = z.object({
  isActive: z.boolean().optional(),
  scheduleDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  scheduleTimeStart: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM').optional(),
  scheduleTimeEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM').optional(),
  searchIntervalHours: z.number().int().min(1).max(168).optional(),
  analyzeDelayMinutes: z.number().int().min(0).max(1440).optional(),
  maxLeadsPerRun: z.number().int().min(1).max(500).optional(),
  maxEmailsPerDay: z.number().int().min(0).max(2000).optional(),
  maxCrmPushPerDay: z.number().int().min(0).max(1000).optional(),
  hotScoreMin: z.number().int().min(1).max(100).optional(),
  warmScoreMin: z.number().int().min(0).max(99).optional(),
  crmAutoSend: z.boolean().optional(),
  crmProvider: z.enum(['rdstation', 'hubspot', 'agendor', 'all']).nullish(),
  crmOwnerUserId: z.string().nullish(),
  emailAutoSend: z.boolean().optional(),
  defaultSequenceId: z.string().nullish(),
  blockedCnpjs: z.array(z.string()).optional(),
  whatsappEnabled: z.boolean().optional(),
});

export const searchProfileSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  priority: z.number().int().min(0).max(999).optional(),
  cnae: z.string().max(10).optional().nullable(),
  cnaeList: z.array(z.string()).optional().nullable(),
  uf: z.array(z.string().length(2)).optional().nullable(),
  municipio: z.string().max(200).optional().nullable(),
  porte: z.array(z.enum(['ME', 'EPP', 'DEMAIS'])).optional().nullable(),
  hasEmail: z.boolean().optional().nullable(),
  hasPhone: z.boolean().optional().nullable(),
  minCapital: z.number().min(0).optional().nullable(),
  openedAfter: z.string().regex(/^\d{8}$/, 'Formato YYYYMMDD').optional().nullable(),
});

export const templateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum([
    'HOT_COLD_INTRO', 'HOT_FOLLOW_NO_OPEN', 'HOT_FOLLOW_OPENED',
    'HOT_LAST_ATTEMPT', 'WARM_WEEK1_EDUCATION', 'WARM_WEEK2_VALUE',
    'WARM_WEEK3_SOCIAL', 'WARM_WEEK4_OFFER', 'CUSTOM',
  ]),
  subject: z.string().min(1).max(500),
  preheader: z.string().max(200).optional().nullable(),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional().nullable(),
  variables: z.array(z.object({ key: z.string(), label: z.string() })).optional().nullable(),
  targetCnae: z.string().max(10).optional().nullable(),
  targetSegment: z.string().max(100).optional().nullable(),
});

export const leadsQuerySchema = z.object({
  status: z.string().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  uf: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Tipos derivados ───────────────────────────────────────────

export type ConfigInput = z.infer<typeof configSchema>;
export type SearchProfileInput = z.infer<typeof searchProfileSchema>;
export type TemplateInput = z.infer<typeof templateSchema>;
export type LeadsQueryInput = z.infer<typeof leadsQuerySchema>;

// Dados de empresa RF passados para o score
export interface RfCompanyData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  email?: string | null;
  ddd?: string | null;
  telefone?: string | null;
  cnaePrincipal: string;
  uf: string;
  municipio?: string | null;
  porte?: string | null;
  capitalSocial?: number | null;
  dataAbertura?: string | null;
}

// Resultado da análise IA (subconjunto do que o analyze module retorna)
export interface AiAnalysisResult {
  score?: number | null;
  summary?: string | null;
  hasWebsite?: boolean;
  strengths?: string[];
  concerns?: string[];
}

// Resultado do cálculo de score
export interface ScoreResult {
  score: number;
  /** Alias para score — uso legado */
  total: number;
  factors: Record<string, number | boolean>;
  /** Alias para factors — uso legado */
  breakdown: Record<string, number | boolean>;
  segment: string | null;
}

// Stats do módulo
export interface AutoProspStats {
  totalLeads: number;
  leadsHot: number;
  leadsWarm: number;
  leadsCold: number;
  leadsConverted: number;
  emailsSent: number;
  crmPushed: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  isActive: boolean;
  runsLast7d: number;
}
