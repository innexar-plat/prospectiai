/**
 * Estrutura do produto: 5 módulos de inteligência comercial.
 * Posicionamento: "Inteligência para crescimento comercial local"
 * Frase: "Descubra onde vender, para quem vender e como abordar."
 */

import type { PlanType } from './billing-config';

/** Planos */
export type ProductPlan = PlanType;

/** Módulos do produto (ordem de valor) */
export const MODULE_KEYS = [
  'MAPEAMENTO',
  'INTELIGENCIA_MERCADO',
  'ANALISE_CONCORRENCIA',
  'ANALISE_MINHA_EMPRESA',
  'INTELIGENCIA_LEADS',
  'ACAO_COMERCIAL',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  shortDescription: string;
  /** Funcionalidades principais (para UI e documentação) */
  features: string[];
  /** Entregas (o que o cliente recebe) */
  deliverables: string[];
  /** Status no backend: já existe, parcial, planejado */
  backendStatus: 'done' | 'partial' | 'planned';
}

export const MODULES: Record<ModuleKey, ModuleDefinition> = {
  MAPEAMENTO: {
    key: 'MAPEAMENTO',
    name: 'Mapeamento',
    shortDescription: 'Buscar empresas por nicho e região',
    features: [
      'Buscar empresas por nicho',
      'Filtrar por região',
      'Filtros por site e telefone',
      'Lista de resultados paginada',
    ],
    deliverables: ['Lista estruturada de empresas', 'Histórico de buscas'],
    backendStatus: 'done', // busca + lista + histórico existem
  },

  INTELIGENCIA_MERCADO: {
    key: 'INTELIGENCIA_MERCADO',
    name: 'Inteligência de Mercado',
    shortDescription: 'Análise de mercado local e tendências por região',
    features: [
      'Quantidade de empresas por segmento',
      'Crescimento por categoria na região',
      'Saturação da região',
      'Ticket médio estimado',
      'Score de maturidade digital',
    ],
    deliverables: [
      'Relatório de mercado automático',
      'Análise comparativa por bairro',
      'Tendência local',
    ],
    backendStatus: 'partial',
  },

  ANALISE_CONCORRENCIA: {
    key: 'ANALISE_CONCORRENCIA',
    name: 'Análise de Concorrência',
    shortDescription: 'Ranking e gaps vs concorrentes no raio',
    features: [
      'Quantos concorrentes no raio',
      'Quem tem mais avaliações',
      'Presença digital (site, redes)',
      'Quem não tem site / redes',
      'Ranking competitivo',
    ],
    deliverables: ['Score competitivo', 'Gap analysis', 'Lista de oportunidades'],
    backendStatus: 'partial',
  },

  ANALISE_MINHA_EMPRESA: {
    key: 'ANALISE_MINHA_EMPRESA',
    name: 'Análise da minha empresa',
    shortDescription: 'Diagnóstico da própria empresa com Reclame Aqui, Google, redes sociais e IA',
    features: [
      'Reputação Reclame Aqui e reclamações',
      'Avaliações Google (rating e reviews)',
      'Presença em redes sociais (link + dados públicos)',
      'Oportunidades e nicho sugerido',
      'Modelo de negócio sugerido',
    ],
    deliverables: [
      'Relatório de análise da empresa',
      'Seção redes sociais',
      'Recomendações e próximos passos',
    ],
    backendStatus: 'done',
  },

  INTELIGENCIA_LEADS: {
    key: 'INTELIGENCIA_LEADS',
    name: 'Inteligência de Leads',
    shortDescription: 'Score e classificação de potencial do lead',
    features: [
      'Score de investimento',
      'Score de urgência',
      'Classificação frio / morno / quente',
      'Potencial financeiro',
      'Probabilidade de compra',
    ],
    deliverables: ['Ranking de leads', 'Filtro por potencial', 'Sugestão de abordagem'],
    backendStatus: 'partial', // score + análise IA existe; scores adicionais planejados
  },

  ACAO_COMERCIAL: {
    key: 'ACAO_COMERCIAL',
    name: 'Ação Comercial',
    shortDescription: 'Abordagem pronta para contato',
    features: [
      'Script de ligação personalizado',
      'E-mail pronto',
      'Mensagem WhatsApp',
      'Pitch adaptado ao nicho',
      'Sequência de follow-up',
    ],
    deliverables: ['Lead pronto para contato', 'Economia de tempo', 'Maior conversão'],
    backendStatus: 'partial', // approach, firstContactMessage, suggestedWhatsAppMessage no LeadAnalysis
  },
};

/** Planos e módulos que cada um desbloqueia (Starter → Growth → Scale) */
export const PLAN_MODULES: Record<ProductPlan, ModuleKey[]> = {
  FREE: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
  BASIC: ['MAPEAMENTO', 'INTELIGENCIA_LEADS'],
  PRO: [
    'MAPEAMENTO',
    'INTELIGENCIA_LEADS',
    'ANALISE_CONCORRENCIA',
    'ACAO_COMERCIAL',
  ],
  BUSINESS: [
    'MAPEAMENTO',
    'INTELIGENCIA_MERCADO',
    'ANALISE_CONCORRENCIA',
    'ANALISE_MINHA_EMPRESA',
    'INTELIGENCIA_LEADS',
    'ACAO_COMERCIAL',
  ],
  SCALE: [
    'MAPEAMENTO',
    'INTELIGENCIA_MERCADO',
    'ANALISE_CONCORRENCIA',
    'ANALISE_MINHA_EMPRESA',
    'INTELIGENCIA_LEADS',
    'ACAO_COMERCIAL',
  ],
};

/** Retorna os módulos disponíveis para um plano */
export function getModulesForPlan(plan: ProductPlan): ModuleKey[] {
  return PLAN_MODULES[plan] ?? PLAN_MODULES.FREE;
}

/** Verifica se o plano tem acesso ao módulo */
export function planHasModule(plan: ProductPlan, moduleKey: ModuleKey): boolean {
  return getModulesForPlan(plan).includes(moduleKey);
}
