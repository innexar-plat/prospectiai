export interface CepLookupResult {
    postalCode: string;
    street: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
}

export function normalizeCnpj(value: string): string {
    return value.replace(/\D/g, '').slice(0, 14);
}

export function formatCnpj(value: string): string {
    const digits = normalizeCnpj(value);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function normalizePostalCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 8);
}

export function formatPostalCode(value: string): string {
    const digits = normalizePostalCode(value);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export async function fetchAddressByCep(
    postalCode: string,
    fetchImpl: typeof fetch = fetch,
): Promise<CepLookupResult> {
    const normalized = normalizePostalCode(postalCode);
    if (normalized.length !== 8) {
        throw new Error('CEP inválido. Informe 8 dígitos.');
    }

    const response = await fetchImpl(`https://viacep.com.br/ws/${normalized}/json/`);
    if (!response.ok) {
        throw new Error('Não foi possível consultar o CEP.');
    }

    const data = (await response.json()) as Record<string, string | boolean | undefined>;
    if (data.erro) {
        throw new Error('CEP não encontrado.');
    }

    return {
        postalCode: formatPostalCode(normalized),
        street: data.logradouro?.toString() ?? '',
        complement: data.complemento?.toString() ?? '',
        neighborhood: data.bairro?.toString() ?? '',
        city: data.localidade?.toString() ?? '',
        state: data.uf?.toString() ?? '',
    };
}

export function toOptionalNumber(value: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function toOptionalInteger(value: string): number | undefined {
    const parsed = toOptionalNumber(value);
    if (parsed == null) return undefined;
    return Math.round(parsed);
}

const KM_PER_MILE = 1.60934;

/** Display operation radius: km for BR, miles for US (stored as km in API). */
export function formatOperationRadiusForDisplay(km: number | null | undefined, market: 'BR' | 'US'): string {
    if (km == null) return '';
    if (market === 'US') return String(Math.round(km / KM_PER_MILE));
    return String(km);
}

/** Parse form radius back to km for API storage. */
export function parseOperationRadiusToKm(value: string, market: 'BR' | 'US'): number | undefined {
    const parsed = toOptionalInteger(value);
    if (parsed == null) return undefined;
    if (market === 'US') return Math.round(parsed * KM_PER_MILE);
    return parsed;
}