import { describe, expect, it, vi } from 'vitest';
import { fetchAddressByCep, formatCnpj, formatPostalCode, normalizeCnpj, normalizePostalCode, toOptionalInteger, toOptionalNumber } from './company-profile';

describe('company-profile helpers', () => {
  it('formats and normalizes cnpj', () => {
    expect(normalizeCnpj('12.345.678/0001-99')).toBe('12345678000199');
    expect(formatCnpj('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('formats and normalizes postal code', () => {
    expect(normalizePostalCode('11000-000')).toBe('11000000');
    expect(formatPostalCode('11000000')).toBe('11000-000');
  });

  it('converts optional numeric strings', () => {
    expect(toOptionalNumber('')).toBeUndefined();
    expect(toOptionalNumber('123,45')).toBe(123.45);
    expect(toOptionalInteger('12,7')).toBe(13);
  });

  it('fetches address by cep', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        logradouro: 'Rua Teste',
        complemento: 'Sala 2',
        bairro: 'Centro',
        localidade: 'Santos',
        uf: 'SP',
      }),
    });
    const result = await fetchAddressByCep('11000-000', fetchMock as unknown as typeof fetch);
    expect(result).toEqual({
      postalCode: '11000-000',
      street: 'Rua Teste',
      complement: 'Sala 2',
      neighborhood: 'Centro',
      city: 'Santos',
      state: 'SP',
    });
  });
});