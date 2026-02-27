/** Country and state options for location filters. */

export const COUNTRIES = [
  { value: 'BR', label: 'Brasil', flag: '🇧🇷' },
  { value: 'AR', label: 'Argentina', flag: '🇦🇷' },
  { value: 'BO', label: 'Bolívia', flag: '🇧🇴' },
  { value: 'CL', label: 'Chile', flag: '🇨🇱' },
  { value: 'CO', label: 'Colômbia', flag: '🇨🇴' },
  { value: 'EC', label: 'Equador', flag: '🇪🇨' },
  { value: 'PY', label: 'Paraguai', flag: '🇵🇾' },
  { value: 'PE', label: 'Peru', flag: '🇵🇪' },
  { value: 'UY', label: 'Uruguai', flag: '🇺🇾' },
  { value: 'VE', label: 'Venezuela', flag: '🇻🇪' },
  { value: 'MX', label: 'México', flag: '🇲🇽' },
  { value: 'US', label: 'Estados Unidos', flag: '🇺🇸' },
  { value: 'PT', label: 'Portugal', flag: '🇵🇹' },
  { value: 'ES', label: 'Espanha', flag: '🇪🇸' },
] as const;

/** Brazilian states (UF). */
export const BR_STATES = [
  'Todos',
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export function getStatesByCountry(countryCode: string): readonly string[] {
  if (countryCode === 'BR') return BR_STATES;
  return ['Todos'];
}

export function getCountryLabel(value: string): string {
  return COUNTRIES.find((c) => c.value === value)?.label ?? value;
}
