/**
 * Maps country names/codes to Google API regionCode and languageCode.
 * Used by search service (Places API) and geocode (Geocoding API)
 * to send locale-correct parameters per country.
 */

export interface CountryLocale {
    /** ISO 3166-1 alpha-2 uppercase (e.g. 'US', 'BR'). Used as Google API regionCode. */
    regionCode: string;
    /** BCP-47 language tag (e.g. 'en', 'pt-BR'). Used as Google API languageCode. */
    languageCode: string;
    /** Country name in its native/common form for Google query context. */
    queryLabel: string;
}

const COUNTRY_MAP: Record<string, CountryLocale> = {
    // Codes
    br:  { regionCode: 'BR', languageCode: 'pt-BR', queryLabel: 'Brasil' },
    us:  { regionCode: 'US', languageCode: 'en',    queryLabel: 'USA' },
    ar:  { regionCode: 'AR', languageCode: 'es',    queryLabel: 'Argentina' },
    bo:  { regionCode: 'BO', languageCode: 'es',    queryLabel: 'Bolivia' },
    cl:  { regionCode: 'CL', languageCode: 'es',    queryLabel: 'Chile' },
    co:  { regionCode: 'CO', languageCode: 'es',    queryLabel: 'Colombia' },
    ec:  { regionCode: 'EC', languageCode: 'es',    queryLabel: 'Ecuador' },
    py:  { regionCode: 'PY', languageCode: 'es',    queryLabel: 'Paraguay' },
    pe:  { regionCode: 'PE', languageCode: 'es',    queryLabel: 'Peru' },
    uy:  { regionCode: 'UY', languageCode: 'es',    queryLabel: 'Uruguay' },
    ve:  { regionCode: 'VE', languageCode: 'es',    queryLabel: 'Venezuela' },
    mx:  { regionCode: 'MX', languageCode: 'es',    queryLabel: 'México' },
    pt:  { regionCode: 'PT', languageCode: 'pt-PT', queryLabel: 'Portugal' },
    es:  { regionCode: 'ES', languageCode: 'es',    queryLabel: 'España' },
    // Names (Portuguese labels from frontend)
    brasil:          { regionCode: 'BR', languageCode: 'pt-BR', queryLabel: 'Brasil' },
    'estados unidos':{ regionCode: 'US', languageCode: 'en',    queryLabel: 'USA' },
    'united states': { regionCode: 'US', languageCode: 'en',    queryLabel: 'USA' },
    argentina:       { regionCode: 'AR', languageCode: 'es',    queryLabel: 'Argentina' },
    'bolívia':       { regionCode: 'BO', languageCode: 'es',    queryLabel: 'Bolivia' },
    bolivia:         { regionCode: 'BO', languageCode: 'es',    queryLabel: 'Bolivia' },
    chile:           { regionCode: 'CL', languageCode: 'es',    queryLabel: 'Chile' },
    'colômbia':      { regionCode: 'CO', languageCode: 'es',    queryLabel: 'Colombia' },
    colombia:        { regionCode: 'CO', languageCode: 'es',    queryLabel: 'Colombia' },
    equador:         { regionCode: 'EC', languageCode: 'es',    queryLabel: 'Ecuador' },
    ecuador:         { regionCode: 'EC', languageCode: 'es',    queryLabel: 'Ecuador' },
    paraguai:        { regionCode: 'PY', languageCode: 'es',    queryLabel: 'Paraguay' },
    paraguay:        { regionCode: 'PY', languageCode: 'es',    queryLabel: 'Paraguay' },
    peru:            { regionCode: 'PE', languageCode: 'es',    queryLabel: 'Peru' },
    uruguai:         { regionCode: 'UY', languageCode: 'es',    queryLabel: 'Uruguay' },
    uruguay:         { regionCode: 'UY', languageCode: 'es',    queryLabel: 'Uruguay' },
    venezuela:       { regionCode: 'VE', languageCode: 'es',    queryLabel: 'Venezuela' },
    'méxico':        { regionCode: 'MX', languageCode: 'es',    queryLabel: 'México' },
    mexico:          { regionCode: 'MX', languageCode: 'es',    queryLabel: 'México' },
    portugal:        { regionCode: 'PT', languageCode: 'pt-PT', queryLabel: 'Portugal' },
    espanha:         { regionCode: 'ES', languageCode: 'es',    queryLabel: 'España' },
    spain:           { regionCode: 'ES', languageCode: 'es',    queryLabel: 'España' },
};

const DEFAULT_LOCALE: CountryLocale = { regionCode: 'BR', languageCode: 'pt-BR', queryLabel: 'Brasil' };

/**
 * Resolve country name or ISO code to Google API locale settings.
 * Accepts: 'BR', 'US', 'Brasil', 'Estados Unidos', 'United States', etc.
 */
export function resolveCountryLocale(country?: string | null): CountryLocale {
    if (!country) return DEFAULT_LOCALE;
    const key = country.trim().toLowerCase();
    return COUNTRY_MAP[key] ?? DEFAULT_LOCALE;
}
