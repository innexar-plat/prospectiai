/**
 * Search service: runs search with validation and maps to API.
 */

import { searchApi, type Place } from './api';
import { getPlaceTypeByValue } from './placeTypes';
import { getCountryQueryLabel } from './locationData';
import { isMarketFeatureEnabled } from './market';

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
  /** CNAE code from Receita Federal (7 digits) — single (legacy) */
  cnae?: string;
  cnaeDescricao?: string;
  /** Multiple CNAE codes for broader RF search */
  cnaes?: string[];
  bypassDbAndRf?: boolean;
}

export interface SearchResult {
  places: Place[];
  nextPageToken?: string;
  fromCache?: boolean;
}

const MIN_QUERY_LENGTH = 3;

export const SEARCH_VALIDATION_KEYS = {
  QUERY_TOO_SHORT: 'dash.search.validation.queryTooShort',
  QUERY_TOO_SHORT_US: 'dash.search.validation.queryTooShortUs',
  NEED_TYPE_OR_TERM: 'dash.search.validation.needTypeOrTerm',
  NEED_TYPE_OR_TERM_US: 'dash.search.validation.needTypeOrTermUs',
  ADVANCED_TERM_MIN: 'dash.search.validation.advancedTermMin',
} as const;

export type SearchTranslateFn = (key: string, options?: Record<string, unknown>) => string;

const VALIDATION_FALLBACKS: Record<string, string> = {
  [SEARCH_VALIDATION_KEYS.QUERY_TOO_SHORT]:
    'Informe pelo menos um nicho, CNAE ou termo de pesquisa (mín. 3 caracteres).',
  [SEARCH_VALIDATION_KEYS.QUERY_TOO_SHORT_US]:
    'Enter a Google category, niche, or keyword (min. 3 characters).',
  [SEARCH_VALIDATION_KEYS.NEED_TYPE_OR_TERM]:
    'Selecione uma categoria/tipo, CNAE ou preencha o termo avançado (mín. 3 caracteres).',
  [SEARCH_VALIDATION_KEYS.NEED_TYPE_OR_TERM_US]:
    'Select a category/type or enter a search term (min. 3 characters).',
  [SEARCH_VALIDATION_KEYS.ADVANCED_TERM_MIN]:
    'Termo avançado deve ter no mínimo 3 caracteres.',
};

function resolveValidationMessage(
  key: string,
  t?: SearchTranslateFn,
  options?: Record<string, unknown>,
): string {
  if (t) return t(key, options);
  return VALIDATION_FALLBACKS[key] ?? key;
}

/** Portuguese-speaking country codes */
const PT_SPEAKING = new Set(['BR', 'PT']);

/** Convert Google type value to readable English query: car_repair → car repair */
function typeValueToEnglish(type: string): string {
  return type.replace(/_/g, ' ');
}

export function buildTextQuery(payload: SearchPayload): string {
  const parts: string[] = [];
  const isPortuguese = !payload.countryCode || PT_SPEAKING.has(payload.countryCode);

  // 1. Core search intent: advanced term, type label, CNAE description, or niche
  const term = payload.advancedTerm?.trim();
  if (term && term.length >= MIN_QUERY_LENGTH) {
    parts.push(term);
  } else if (payload.includedType) {
    if (isPortuguese) {
      const typeOption = getPlaceTypeByValue(payload.includedType);
      parts.push(typeOption ? typeOption.label : 'empresas');
    } else {
      // Use English type name for non-Portuguese countries (e.g. "pharmacy" not "Farmácia")
      parts.push(typeValueToEnglish(payload.includedType));
    }
  } else if (payload.cnaeDescricao?.trim()) {
    // Use CNAE description as search query for Google Places
    parts.push(payload.cnaeDescricao.trim());
  } else if (payload.niches && payload.niches.length > 0) {
    parts.push(payload.niches[0]!);
  } else {
    parts.push(isPortuguese ? 'empresas' : 'businesses');
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

export function validateSearchPayload(
  payload: SearchPayload,
  t?: SearchTranslateFn,
): { ok: true } | { ok: false; message: string; messageKey: string } {
  const cnaeEnabled = isMarketFeatureEnabled('cnae');
  const hasCnae = cnaeEnabled && (!!payload.cnae?.trim() || (payload.cnaes?.length ?? 0) > 0);
  const query = buildTextQuery(payload);
  if (query.length < MIN_QUERY_LENGTH && !hasCnae) {
    const messageKey = cnaeEnabled
      ? SEARCH_VALIDATION_KEYS.QUERY_TOO_SHORT
      : SEARCH_VALIDATION_KEYS.QUERY_TOO_SHORT_US;
    return { ok: false, messageKey, message: resolveValidationMessage(messageKey, t) };
  }
  const advancedLen = (payload.advancedTerm?.trim() ?? '').length;
  const hasType = !!payload.includedType?.trim();
  const hasNiches = payload.niches.length > 0;
  if (!hasType && !hasNiches && !hasCnae && advancedLen < MIN_QUERY_LENGTH) {
    const messageKey = cnaeEnabled
      ? SEARCH_VALIDATION_KEYS.NEED_TYPE_OR_TERM
      : SEARCH_VALIDATION_KEYS.NEED_TYPE_OR_TERM_US;
    return { ok: false, messageKey, message: resolveValidationMessage(messageKey, t) };
  }
  return { ok: true };
}

export async function startSearch(payload: SearchPayload, t?: SearchTranslateFn): Promise<SearchResult> {
  const validation = validateSearchPayload(payload, t);
  if (!validation.ok) throw new Error(validation.message);

  const textQuery = buildTextQuery(payload);

  // Run Google Places search
  const googlePromise = searchApi.search({
    textQuery,
    includedType: payload.includedType?.trim() || undefined,
    city: payload.city?.trim() || undefined,
    state: payload.state?.trim() || undefined,
    country: payload.countryCode?.trim() || payload.country?.trim() || undefined,
    radiusKm: payload.radiusKm,
    hasWebsite: payload.hasWebsite && payload.hasWebsite !== 'any' ? payload.hasWebsite : undefined,
    hasPhone: payload.hasPhone && payload.hasPhone !== 'any' ? payload.hasPhone : undefined,
    bypassDbAndRf: payload.bypassDbAndRf,
  });

  const res = await googlePromise;

  return {
    places: res.places ?? [],
    nextPageToken: res.nextPageToken,
    fromCache: (res as { fromCache?: boolean }).fromCache,
  };
}
