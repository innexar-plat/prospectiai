import type { SessionUser } from '@/lib/api';

function isFilled(value: string | number | null | undefined): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim().length > 0;
}

export function getProfileCompleteness(user: SessionUser): {
  percent: number;
  isCompleteEnough: boolean;
  missing: string[];
} {
  const checks = [
    { ok: isFilled(user.companyName), label: 'nome da empresa' },
    { ok: isFilled(user.productService), label: 'produto ou serviço' },
    { ok: isFilled(user.targetAudience), label: 'público-alvo' },
    { ok: isFilled(user.mainBenefit), label: 'benefício principal' },
    { ok: isFilled(user.city), label: 'cidade' },
    { ok: isFilled(user.state), label: 'estado' },
    { ok: isFilled(user.cnpj) || isFilled(user.websiteUrl), label: 'CNPJ ou site' },
    { ok: isFilled(user.serviceModel) || isFilled(user.averageTicket), label: 'modelo de atendimento ou ticket médio' },
  ];
  const completed = checks.filter((item) => item.ok).length;
  const percent = Math.round((completed / checks.length) * 100);
  return {
    percent,
    isCompleteEnough: completed >= 6,
    missing: checks.filter((item) => !item.ok).map((item) => item.label),
  };
}