import type { SessionUser } from '@/lib/api';

function isFilled(value: string | number | null | undefined): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim().length > 0;
}

export function getProfileCompleteness(user: SessionUser): {
  percent: number;
  isCompleteEnough: boolean;
  missingKeys: string[];
} {
  const checks = [
    { ok: isFilled(user.companyName), labelKey: 'common.profile.field.companyName' },
    { ok: isFilled(user.productService), labelKey: 'common.profile.field.productService' },
    { ok: isFilled(user.targetAudience), labelKey: 'common.profile.field.targetAudience' },
    { ok: isFilled(user.mainBenefit), labelKey: 'common.profile.field.mainBenefit' },
    { ok: isFilled(user.city), labelKey: 'common.profile.field.city' },
    { ok: isFilled(user.state), labelKey: 'common.profile.field.state' },
    { ok: isFilled(user.cnpj) || isFilled(user.websiteUrl), labelKey: 'common.profile.field.cnpjOrWebsite' },
    { ok: isFilled(user.serviceModel) || isFilled(user.averageTicket), labelKey: 'common.profile.field.serviceModelOrTicket' },
  ];
  const completed = checks.filter((item) => item.ok).length;
  const percent = Math.round((completed / checks.length) * 100);
  return {
    percent,
    isCompleteEnough: completed >= 6,
    missingKeys: checks.filter((item) => !item.ok).map((item) => item.labelKey),
  };
}