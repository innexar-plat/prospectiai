import { fetchWithRetry } from '@/lib/fetch-http';

const BRASIL_API_CNPJ_BASE = 'https://brasilapi.com.br/api/cnpj/v1';

type BrasilApiCnpjResponse = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  porte?: string;
  natureza_juridica?: string;
  descricao_situacao_cadastral?: string;
  data_inicio_atividade?: string;
  cnae_fiscal_descricao?: string;
};

export type CnpjEnrichmentData = {
  cnpj: string;
  companyLegalName?: string;
  companyTradeName?: string;
  companySize?: string;
  companyLegalNature?: string;
  companyMainCnae?: string;
  cnpjStatus?: string;
  cnpjOpenedAt?: string;
};

export function normalizeCnpj(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  if (!isValidCnpj(digits)) return null;
  return digits;
}

/** Validate CNPJ check digits (mod-11 algorithm). */
function isValidCnpj(digits: string): boolean {
  // Reject all-same-digit sequences (e.g. 00000000000000)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * w1[i];
  let rem = sum % 11;
  if (Number(digits[12]) !== (rem < 2 ? 0 : 11 - rem)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(digits[i]) * w2[i];
  rem = sum % 11;
  if (Number(digits[13]) !== (rem < 2 ? 0 : 11 - rem)) return false;

  return true;
}

export function extractCnpjFromText(value: string | null | undefined): string | null {
  if (!value) return null;
  const direct = normalizeCnpj(value);
  if (direct) return direct;

  const matches = value.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14}/g);
  if (!matches || matches.length === 0) return null;

  for (const m of matches) {
    const normalized = normalizeCnpj(m);
    if (normalized) return normalized;
  }

  return null;
}

export async function fetchCnpjFromBrasilApi(cnpj: string): Promise<CnpjEnrichmentData | null> {
  const normalized = normalizeCnpj(cnpj);
  if (!normalized) return null;

  const res = await fetchWithRetry(
    `${BRASIL_API_CNPJ_BASE}/${normalized}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    {
      timeoutMs: 12000,
      maxRetries: 1,
      retryStatuses: (status) => status === 429 || (status >= 500 && status < 600),
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`BrasilAPI CNPJ error (${res.status}): ${err}`);
  }

  const body = (await res.json()) as BrasilApiCnpjResponse;
  const bodyCnpj = normalizeCnpj(body.cnpj ?? normalized) ?? normalized;

  return {
    cnpj: bodyCnpj,
    companyLegalName: body.razao_social?.trim() || undefined,
    companyTradeName: body.nome_fantasia?.trim() || undefined,
    companySize: body.porte?.trim() || undefined,
    companyLegalNature: body.natureza_juridica?.trim() || undefined,
    companyMainCnae: body.cnae_fiscal_descricao?.trim() || undefined,
    cnpjStatus: body.descricao_situacao_cadastral?.trim() || undefined,
    cnpjOpenedAt: body.data_inicio_atividade?.trim() || undefined,
  };
}
