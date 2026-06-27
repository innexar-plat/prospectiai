/** Country and state options for location filters. */

import { getActiveMarket, type Market } from '@/lib/market';

export interface StateOption { value: string; label: string }

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

export type CountryOption = (typeof COUNTRIES)[number];

/** Countries available in location pickers — US market is gated to US only. */
export function getSearchCountries(market: Market = getActiveMarket()): readonly CountryOption[] {
  if (market === 'US') {
    return COUNTRIES.filter((c) => c.value === 'US');
  }
  return COUNTRIES;
}

/** Brazilian states — value=UF, label=full name */
export const BR_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todos os estados' },
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

/** US states and DC */
export const US_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'All states' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

/** Argentine provinces */
export const AR_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todas las provincias' },
  { value: 'Buenos Aires', label: 'Buenos Aires' }, { value: 'CABA', label: 'Ciudad Autónoma de Buenos Aires' },
  { value: 'Catamarca', label: 'Catamarca' }, { value: 'Chaco', label: 'Chaco' }, { value: 'Chubut', label: 'Chubut' },
  { value: 'Córdoba', label: 'Córdoba' }, { value: 'Corrientes', label: 'Corrientes' }, { value: 'Entre Ríos', label: 'Entre Ríos' },
  { value: 'Formosa', label: 'Formosa' }, { value: 'Jujuy', label: 'Jujuy' }, { value: 'La Pampa', label: 'La Pampa' },
  { value: 'La Rioja', label: 'La Rioja' }, { value: 'Mendoza', label: 'Mendoza' }, { value: 'Misiones', label: 'Misiones' },
  { value: 'Neuquén', label: 'Neuquén' }, { value: 'Río Negro', label: 'Río Negro' }, { value: 'Salta', label: 'Salta' },
  { value: 'San Juan', label: 'San Juan' }, { value: 'San Luis', label: 'San Luis' }, { value: 'Santa Cruz', label: 'Santa Cruz' },
  { value: 'Santa Fe', label: 'Santa Fe' }, { value: 'Santiago del Estero', label: 'Santiago del Estero' },
  { value: 'Tierra del Fuego', label: 'Tierra del Fuego' }, { value: 'Tucumán', label: 'Tucumán' },
];

/** Mexican states */
export const MX_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todos los estados' },
  { value: 'Aguascalientes', label: 'Aguascalientes' }, { value: 'Baja California', label: 'Baja California' },
  { value: 'Baja California Sur', label: 'Baja California Sur' }, { value: 'Campeche', label: 'Campeche' },
  { value: 'Chiapas', label: 'Chiapas' }, { value: 'Chihuahua', label: 'Chihuahua' }, { value: 'CDMX', label: 'Ciudad de México' },
  { value: 'Coahuila', label: 'Coahuila' }, { value: 'Colima', label: 'Colima' }, { value: 'Durango', label: 'Durango' },
  { value: 'Guanajuato', label: 'Guanajuato' }, { value: 'Guerrero', label: 'Guerrero' }, { value: 'Hidalgo', label: 'Hidalgo' },
  { value: 'Jalisco', label: 'Jalisco' }, { value: 'Estado de México', label: 'Estado de México' }, { value: 'Michoacán', label: 'Michoacán' },
  { value: 'Morelos', label: 'Morelos' }, { value: 'Nayarit', label: 'Nayarit' }, { value: 'Nuevo León', label: 'Nuevo León' },
  { value: 'Oaxaca', label: 'Oaxaca' }, { value: 'Puebla', label: 'Puebla' }, { value: 'Querétaro', label: 'Querétaro' },
  { value: 'Quintana Roo', label: 'Quintana Roo' }, { value: 'San Luis Potosí', label: 'San Luis Potosí' },
  { value: 'Sinaloa', label: 'Sinaloa' }, { value: 'Sonora', label: 'Sonora' }, { value: 'Tabasco', label: 'Tabasco' },
  { value: 'Tamaulipas', label: 'Tamaulipas' }, { value: 'Tlaxcala', label: 'Tlaxcala' }, { value: 'Veracruz', label: 'Veracruz' },
  { value: 'Yucatán', label: 'Yucatán' }, { value: 'Zacatecas', label: 'Zacatecas' },
];

/** Colombian departments */
export const CO_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todos los departamentos' },
  { value: 'Amazonas', label: 'Amazonas' }, { value: 'Antioquia', label: 'Antioquia' }, { value: 'Arauca', label: 'Arauca' },
  { value: 'Atlántico', label: 'Atlántico' }, { value: 'Bogotá D.C.', label: 'Bogotá D.C.' }, { value: 'Bolívar', label: 'Bolívar' },
  { value: 'Boyacá', label: 'Boyacá' }, { value: 'Caldas', label: 'Caldas' }, { value: 'Caquetá', label: 'Caquetá' },
  { value: 'Casanare', label: 'Casanare' }, { value: 'Cauca', label: 'Cauca' }, { value: 'Cesar', label: 'Cesar' },
  { value: 'Chocó', label: 'Chocó' }, { value: 'Córdoba', label: 'Córdoba' }, { value: 'Cundinamarca', label: 'Cundinamarca' },
  { value: 'Guainía', label: 'Guainía' }, { value: 'Guaviare', label: 'Guaviare' }, { value: 'Huila', label: 'Huila' },
  { value: 'La Guajira', label: 'La Guajira' }, { value: 'Magdalena', label: 'Magdalena' }, { value: 'Meta', label: 'Meta' },
  { value: 'Nariño', label: 'Nariño' }, { value: 'Norte de Santander', label: 'Norte de Santander' }, { value: 'Putumayo', label: 'Putumayo' },
  { value: 'Quindío', label: 'Quindío' }, { value: 'Risaralda', label: 'Risaralda' }, { value: 'Santander', label: 'Santander' },
  { value: 'Sucre', label: 'Sucre' }, { value: 'Tolima', label: 'Tolima' }, { value: 'Valle del Cauca', label: 'Valle del Cauca' },
];

/** Chilean regions */
export const CL_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todas las regiones' },
  { value: 'Arica y Parinacota', label: 'Arica y Parinacota' }, { value: 'Tarapacá', label: 'Tarapacá' },
  { value: 'Antofagasta', label: 'Antofagasta' }, { value: 'Atacama', label: 'Atacama' }, { value: 'Coquimbo', label: 'Coquimbo' },
  { value: 'Valparaíso', label: 'Valparaíso' }, { value: 'Metropolitana', label: 'Región Metropolitana' },
  { value: "O'Higgins", label: "O'Higgins" }, { value: 'Maule', label: 'Maule' }, { value: 'Ñuble', label: 'Ñuble' },
  { value: 'Biobío', label: 'Biobío' }, { value: 'Araucanía', label: 'Araucanía' }, { value: 'Los Ríos', label: 'Los Ríos' },
  { value: 'Los Lagos', label: 'Los Lagos' }, { value: 'Aysén', label: 'Aysén' }, { value: 'Magallanes', label: 'Magallanes' },
];

/** Peruvian departments */
export const PE_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todos los departamentos' },
  { value: 'Amazonas', label: 'Amazonas' }, { value: 'Áncash', label: 'Áncash' }, { value: 'Apurímac', label: 'Apurímac' },
  { value: 'Arequipa', label: 'Arequipa' }, { value: 'Ayacucho', label: 'Ayacucho' }, { value: 'Cajamarca', label: 'Cajamarca' },
  { value: 'Callao', label: 'Callao' }, { value: 'Cusco', label: 'Cusco' }, { value: 'Huancavelica', label: 'Huancavelica' },
  { value: 'Huánuco', label: 'Huánuco' }, { value: 'Ica', label: 'Ica' }, { value: 'Junín', label: 'Junín' },
  { value: 'La Libertad', label: 'La Libertad' }, { value: 'Lambayeque', label: 'Lambayeque' }, { value: 'Lima', label: 'Lima' },
  { value: 'Loreto', label: 'Loreto' }, { value: 'Madre de Dios', label: 'Madre de Dios' }, { value: 'Moquegua', label: 'Moquegua' },
  { value: 'Pasco', label: 'Pasco' }, { value: 'Piura', label: 'Piura' }, { value: 'Puno', label: 'Puno' },
  { value: 'San Martín', label: 'San Martín' }, { value: 'Tacna', label: 'Tacna' }, { value: 'Tumbes', label: 'Tumbes' },
  { value: 'Ucayali', label: 'Ucayali' },
];

/** Portuguese districts */
export const PT_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todos os distritos' },
  { value: 'Aveiro', label: 'Aveiro' }, { value: 'Beja', label: 'Beja' }, { value: 'Braga', label: 'Braga' },
  { value: 'Bragança', label: 'Bragança' }, { value: 'Castelo Branco', label: 'Castelo Branco' }, { value: 'Coimbra', label: 'Coimbra' },
  { value: 'Évora', label: 'Évora' }, { value: 'Faro', label: 'Faro' }, { value: 'Guarda', label: 'Guarda' },
  { value: 'Leiria', label: 'Leiria' }, { value: 'Lisboa', label: 'Lisboa' }, { value: 'Portalegre', label: 'Portalegre' },
  { value: 'Porto', label: 'Porto' }, { value: 'Santarém', label: 'Santarém' }, { value: 'Setúbal', label: 'Setúbal' },
  { value: 'Viana do Castelo', label: 'Viana do Castelo' }, { value: 'Vila Real', label: 'Vila Real' }, { value: 'Viseu', label: 'Viseu' },
];

/** Spanish autonomous communities */
export const ES_STATES: readonly StateOption[] = [
  { value: 'Todos', label: 'Todas las comunidades' },
  { value: 'Andalucía', label: 'Andalucía' }, { value: 'Aragón', label: 'Aragón' }, { value: 'Asturias', label: 'Asturias' },
  { value: 'Baleares', label: 'Islas Baleares' }, { value: 'Canarias', label: 'Canarias' }, { value: 'Cantabria', label: 'Cantabria' },
  { value: 'Castilla-La Mancha', label: 'Castilla-La Mancha' }, { value: 'Castilla y León', label: 'Castilla y León' },
  { value: 'Cataluña', label: 'Cataluña' }, { value: 'Extremadura', label: 'Extremadura' }, { value: 'Galicia', label: 'Galicia' },
  { value: 'Madrid', label: 'Madrid' }, { value: 'Murcia', label: 'Murcia' }, { value: 'Navarra', label: 'Navarra' },
  { value: 'País Vasco', label: 'País Vasco' }, { value: 'La Rioja', label: 'La Rioja' }, { value: 'Valencia', label: 'Comunidad Valenciana' },
];

const FALLBACK_STATES: readonly StateOption[] = [{ value: 'Todos', label: 'Todos' }];

export function getStatesByCountry(countryCode: string): readonly StateOption[] {
  switch (countryCode) {
    case 'BR': return BR_STATES;
    case 'US': return US_STATES;
    case 'AR': return AR_STATES;
    case 'MX': return MX_STATES;
    case 'CO': return CO_STATES;
    case 'CL': return CL_STATES;
    case 'PE': return PE_STATES;
    case 'PT': return PT_STATES;
    case 'ES': return ES_STATES;
    default: return FALLBACK_STATES;
  }
}

/** Whether the given country has detailed state/province data for autocomplete. */
export function countryHasStates(countryCode: string): boolean {
  return ['BR', 'US', 'AR', 'MX', 'CO', 'CL', 'PE', 'PT', 'ES'].includes(countryCode);
}

/** Normalize ISO country codes (e.g. "us" → "US") for lookups and display. */
export function normalizeCountryCode(value: string): string {
  const upper = value.trim().toUpperCase();
  if (COUNTRIES.some((c) => c.value === upper)) return upper;
  if (upper === 'USA' || upper === 'UNITED STATES') return 'US';
  return upper;
}

export function getCountryLabel(value: string): string {
  const code = normalizeCountryCode(value);
  return COUNTRIES.find((c) => c.value === code)?.label ?? value;
}

export function getLocalizedCountryLabel(
  value: string,
  t: (key: string) => string,
): string {
  const key = `location.country.${value}`;
  const translated = t(key);
  return translated !== key ? translated : getCountryLabel(value);
}

/** State value → display label (e.g. 'SP' → 'São Paulo (SP)'). */
export function getStateLabel(countryCode: string, stateValue: string): string {
  if (stateValue === 'Todos') return stateValue;
  const states = getStatesByCountry(countryCode);
  const found = states.find((s) => s.value === stateValue);
  if (!found || found.value === found.label) return stateValue;
  // For BR, show "SP" as the compact display (full name in dropdown)
  return countryCode === 'BR' ? stateValue : found.label;
}

/** Returns a search-friendly country label for Google Places textQuery (e.g. 'USA' instead of 'Estados Unidos'). */
export function getCountryQueryLabel(value: string): string {
  return COUNTRIES.find((c) => c.value === value)?.queryLabel ?? value;
}
