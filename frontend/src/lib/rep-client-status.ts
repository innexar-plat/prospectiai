export const REP_CLIENT_STATUSES = ['LEAD', 'CONVERTED', 'ACTIVE', 'CANCELED', 'REFUNDED'] as const;

export type RepClientStatus = (typeof REP_CLIENT_STATUSES)[number];

export const REP_CLIENT_STATUS_BADGE: Record<RepClientStatus, string> = {
  LEAD: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  CONVERTED: 'bg-green-500/10 text-green-600 border-green-500/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  CANCELED: 'bg-red-500/10 text-red-600 border-red-500/20',
  REFUNDED: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

export const REP_CLIENT_STATUS_LABEL: Record<RepClientStatus, string> = {
  LEAD: 'Lead',
  CONVERTED: 'Convertido',
  ACTIVE: 'Ativo',
  CANCELED: 'Cancelado',
  REFUNDED: 'Reembolsado',
};
