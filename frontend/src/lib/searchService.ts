/**
 * Search service: runs search with validation and maps to API.
 */

import { searchApi, rfSearchApi, type Place, type RfCompanyResult } from './api';
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
  /** CNAE code from Receita Federal (7 digits) — single (legacy) */
  cnae?: string;
  cnaeDescricao?: string;
  /** Multiple CNAE codes for broader RF search */
  cnaes?: string[];
}

export interface SearchResult {
  places: Place[];
  nextPageToken?: string;
  fromCache?: boolean;
}

const MIN_QUERY_LENGTH = 3;

export function buildTextQuery(payload: SearchPayload): string {
  const parts: string[] = [];

  // 1. Core search intent: advanced term, type label, CNAE description, or niche
  const term = payload.advancedTerm?.trim();
  if (term && term.length >= MIN_QUERY_LENGTH) {
    parts.push(term);
  } else if (payload.includedType) {
    const typeOption = getPlaceTypeByValue(payload.includedType);
    parts.push(typeOption ? typeOption.label : 'empresas');
  } else if (payload.cnaeDescricao?.trim()) {
    // Use CNAE description as search query for Google Places
    parts.push(payload.cnaeDescricao.trim());
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
  const hasCnae = !!payload.cnae?.trim() || (payload.cnaes?.length ?? 0) > 0;
  const query = buildTextQuery(payload);
  if (query.length < MIN_QUERY_LENGTH && !hasCnae) {
    return { ok: false, message: 'Informe pelo menos um nicho, CNAE ou termo de pesquisa (mín. 3 caracteres).' };
  }
  const advancedLen = (payload.advancedTerm?.trim() ?? '').length;
  const hasType = !!payload.includedType?.trim();
  const hasNiches = payload.niches.length > 0;
  if (!hasType && !hasNiches && !hasCnae && advancedLen < MIN_QUERY_LENGTH) {
    return { ok: false, message: 'Selecione uma categoria/tipo, CNAE ou preencha o termo avançado (mín. 3 caracteres).' };
  }
  return { ok: true };
}

export async function startSearch(payload: SearchPayload): Promise<SearchResult> {
  const validation = validateSearchPayload(payload);
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
  });

  // If CNAE filter is active (single or multiple), also search Receita Federal data
  let rfPlaces: Place[] = [];
  const effectiveCnaes = payload.cnaes?.length ? payload.cnaes : payload.cnae?.trim() ? [payload.cnae.trim()] : [];
  if (effectiveCnaes.length > 0) {
    try {
      const ufCode = payload.state && payload.state !== 'Todos' ? payload.state : undefined;
      const rfRes = await rfSearchApi.search({
        cnaes: effectiveCnaes,
        uf: ufCode,
        municipio: payload.city?.trim() || undefined,
        pageSize: 50,
      });
      rfPlaces = (rfRes.companies ?? []).map(rfToPlace);
    } catch {
      // RF search failed, continue with Google only
    }
  }

  const res = await googlePromise;
  // Merge: RF results first (unique by name), then Google results
  const googlePlaces = res.places ?? [];
  const merged = mergeResults(rfPlaces, googlePlaces);

  return {
    places: merged,
    nextPageToken: res.nextPageToken,
    fromCache: (res as { fromCache?: boolean }).fromCache,
  };
}

/** Convert RF company to Place format for unified display */
function rfToPlace(rf: RfCompanyResult): Place {
  const phone = rf.telefone || undefined;
  const address = [rf.logradouro, rf.numero, rf.bairro, rf.municipio, rf.uf]
    .filter(Boolean)
    .join(', ');
  return {
    id: `rf_${rf.cnpj}`,
    displayName: { text: rf.nomeFantasia || rf.razaoSocial, languageCode: 'pt-BR' },
    formattedAddress: address || undefined,
    nationalPhoneNumber: phone,
    websiteUri: undefined,
    cnpj: rf.cnpj,
    companyLegalName: rf.razaoSocial,
    companyTradeName: rf.nomeFantasia || undefined,
    companyMainCnae: rf.cnaeDescricao || undefined,
    cnpjStatus: 'ATIVA',
    rating: undefined,
    userRatingCount: undefined,
    types: [],
    businessStatus: 'OPERATIONAL',
    opportunityScore: rf.porte === 'DEMAIS' ? 60 : rf.porte === 'EPP' ? 50 : 40,
    // Extra RF fields
    rfData: {
      porte: rf.porte,
      capitalSocial: rf.capitalSocial,
      email: rf.email,
      cep: rf.cep,
      dataAbertura: rf.dataAbertura,
      cnaePrincipal: rf.cnaePrincipal,
      cnaeDescricao: rf.cnaeDescricao,
    },
  } as Place;
}

/** Merge RF and Google results, avoiding duplicates by company name similarity */
function mergeResults(rfPlaces: Place[], googlePlaces: Place[]): Place[] {
  const seen = new Set<string>();
  const result: Place[] = [];

  // Add RF results first (tagged with rf_ prefix in ID)
  for (const p of rfPlaces) {
    const name = (p.displayName?.text ?? '').toLowerCase().trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(p);
    }
  }

  // Add Google results that don't match RF names
  for (const p of googlePlaces) {
    const name = (p.displayName?.text ?? '').toLowerCase().trim();
    if (!seen.has(name)) {
      seen.add(name);
      result.push(p);
    }
  }

  return result;
}
