export const REP_CLIENT_STATUSES = ['LEAD', 'CONVERTED', 'ACTIVE', 'CANCELED', 'REFUNDED'] as const;

export type RepClientStatus = (typeof REP_CLIENT_STATUSES)[number];
