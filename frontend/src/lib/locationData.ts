/** Country and state options for location filters. */

export const COUNTRIES = [
  { value: 'BR', label: 'Brasil', queryLabel: 'Brasil', flag: '🇧🇷' },
  { value: 'AR', label: 'Argentina', queryLabel: 'Argentina', flag: '🇦🇷' },
  { value: 'BO', label: 'Bolívia', queryLabel: 'Bolivia', flag: '🇧🇴' },
  { value: 'CL', label: 'Chile', queryLabel: 'Chile', flag: '🇨🇱' },
  { value: 'CO', label: 'Colômbia', queryLabel: 'Colombia', flag: '🇨🇴' },
  { value: 'EC', label: 'Equador', queryLabel: 'Ecuador', flag: '🇪🇨' },
  { value: 'PY', label: 'Paraguai', queryLabel: 'Paraguay', flag: '🇵🇾' },
  { value: 'PE', label: 'Peru', queryLabel: 'Peru', flag: '🇵🇪' },
  { value: 'UY', label: 'Uruguai', queryLabel: 'Uruguay', flag: '🇺🇾' },
  { value: 'VE', label: 'Venezuela', queryLabel: 'Venezuela', flag: '🇻🇪' },
  { value: 'MX', label: 'México', queryLabel: 'México', flag: '🇲🇽' },
  { value: 'US', label: 'Estados Unidos', queryLabel: 'USA', flag: '🇺🇸' },
  { value: 'PT', label: 'Portugal', queryLabel: 'Portugal', flag: '🇵🇹' },
  { value: 'ES', label: 'Espanha', queryLabel: 'España', flag: '🇪🇸' },
] as const;

/** Brazilian states (UF). */
export const BR_STATES = [
  'Todos',
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** US states and DC (2-letter codes). */
export const US_STATES = [
  'Todos',
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

export function getStatesByCountry(countryCode: string): readonly string[] {
  if (countryCode === 'BR') return BR_STATES;
  if (countryCode === 'US') return US_STATES;
  return ['Todos'];
}

export function getCountryLabel(value: string): string {
  return COUNTRIES.find((c) => c.value === value)?.label ?? value;
}

/** Returns a search-friendly country label for Google Places textQuery (e.g. 'USA' instead of 'Estados Unidos'). */
export function getCountryQueryLabel(value: string): string {
  return COUNTRIES.find((c) => c.value === value)?.queryLabel ?? value;
}
