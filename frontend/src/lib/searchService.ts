/**
 * Search service: runs search with validation and maps to API.
 */

import { searchApi, type Place } from './api';
import { getPlaceTypeByValue } from './placeTypes';

export interface SearchPayload {
  textQuery?: string;
  country?: string;
  state?: string;
  city?: string;
  radiusKm?: number;
  /** Google Place type (Table A) para filtro includedType */
  includedType?: string;
  niches: string[];
  advancedTerm?: string;
}

export interface SearchResult {
  places: Place[];
  nextPageToken?: string;
  fromCache?: boolean;
}

const MIN_QUERY_LENGTH = 3;

export function buildTextQuery(payload: SearchPayload): string {
  const term = payload.advancedTerm?.trim();
  if (term && term.length >= MIN_QUERY_LENGTH) return term;

  const parts: string[] = [];

  if (payload.includedType) {
    const typeOption = getPlaceTypeByValue(payload.includedType);
    if (typeOption) {
      parts.push(typeOption.label);
    } else {
      parts.push('empresas');
    }
  } else if (payload.niches && payload.niches.length > 0) {
    parts.push(payload.niches[0]);
  } else {
    parts.push('empresas');
  }

  if (payload.city?.trim()) parts.push(payload.city.trim());
  if (payload.state?.trim() && payload.state !== 'Todos') parts.push(payload.state.trim());
  parts.push(payload.country || 'Brasil');

  return parts.join(' ');
}

export function validateSearchPayload(payload: SearchPayload): { ok: true } | { ok: false; message: string } {
  const query = buildTextQuery(payload);
  if (query.length < MIN_QUERY_LENGTH) {
    return { ok: false, message: 'Informe pelo menos um nicho ou termo de pesquisa (mín. 3 caracteres).' };
  }
  const advancedLen = (payload.advancedTerm?.trim() ?? '').length;
  const hasType = !!payload.includedType?.trim();
  const hasNiches = payload.niches.length > 0;
  if (!hasType && !hasNiches && advancedLen < MIN_QUERY_LENGTH) {
    return { ok: false, message: 'Selecione uma categoria/tipo ou preencha o termo avançado (mín. 3 caracteres).' };
  }
  return { ok: true };
}

export async function startSearch(payload: SearchPayload): Promise<SearchResult> {
  const validation = validateSearchPayload(payload);
  if (!validation.ok) throw new Error(validation.message);

  const textQuery = buildTextQuery(payload);
  const res = await searchApi.search({
    textQuery,
    includedType: payload.includedType?.trim() || undefined,
    city: payload.city?.trim() || undefined,
    state: payload.state?.trim() || undefined,
    country: payload.country?.trim() || undefined,
    radiusKm: payload.radiusKm,
  });
  return {
    places: res.places ?? [],
    nextPageToken: res.nextPageToken,
    fromCache: (res as { fromCache?: boolean }).fromCache,
  };
}
