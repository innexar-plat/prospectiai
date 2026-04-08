/**
 * Search service: runs search with validation and maps to API.
 */

import { searchApi, type Place } from './api';
import { getPlaceTypeByValue } from './placeTypes';
import { getCountryQueryLabel } from './locationData';

export interface SearchPayload {
  textQuery?: string;
  country?: string;
  /** ISO country code (e.g. 'US', 'BR') — passed to backend for regionCode/languageCode resolution. */
  countryCode?: string;
  state?: string;
  city?: string;
  radiusKm?: number;
  /** Google Place type (Table A) para filtro includedType */
  includedType?: string;
  niches: string[];
  advancedTerm?: string;
  hasWebsite?: 'any' | 'yes' | 'no';
  hasPhone?: 'any' | 'yes' | 'no';
}

export interface SearchResult {
  places: Place[];
  nextPageToken?: string;
  fromCache?: boolean;
}

const MIN_QUERY_LENGTH = 3;

export function buildTextQuery(payload: SearchPayload): string {
  const parts: string[] = [];

  // 1. Core search intent: advanced term, type label, or niche
  const term = payload.advancedTerm?.trim();
  if (term && term.length >= MIN_QUERY_LENGTH) {
    parts.push(term);
  } else if (payload.includedType) {
    const typeOption = getPlaceTypeByValue(payload.includedType);
    parts.push(typeOption ? typeOption.label : 'empresas');
  } else if (payload.niches && payload.niches.length > 0) {
    parts.push(payload.niches[0]);
  } else {
    parts.push('empresas');
  }

  // 2. Always append location context for better Google Places relevance
  if (payload.city?.trim()) parts.push(payload.city.trim());
  if (payload.state?.trim() && payload.state !== 'Todos') parts.push(payload.state.trim());

  // 3. Append country using a search-friendly label (e.g. 'USA' not 'Estados Unidos')
  //    Only when no city/state to avoid overly long queries
  if (!payload.city?.trim() && (!payload.state?.trim() || payload.state === 'Todos')) {
    const countryForQuery = payload.countryCode
      ? getCountryQueryLabel(payload.countryCode)
      : (payload.country || 'Brasil');
    parts.push(countryForQuery);
  }

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
    // Send country label for backward compat; backend resolveCountryLocale handles both codes and names
    country: payload.countryCode?.trim() || payload.country?.trim() || undefined,
    radiusKm: payload.radiusKm,
    hasWebsite: payload.hasWebsite && payload.hasWebsite !== 'any' ? payload.hasWebsite : undefined,
    hasPhone: payload.hasPhone && payload.hasPhone !== 'any' ? payload.hasPhone : undefined,
  });
  return {
    places: res.places ?? [],
    nextPageToken: res.nextPageToken,
    fromCache: (res as { fromCache?: boolean }).fromCache,
  };
}
