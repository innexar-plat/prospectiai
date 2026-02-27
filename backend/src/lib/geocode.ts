/**
 * Geocoding via Google Geocoding API.
 * Resolves city/state/country to lat/lng for Places API locationBias.
 * Center = cidade; raio (escolhido no UI em km) é aplicado a partir desse centro.
 * Uses GOOGLE_PLACES_API_KEY (same key can have Geocoding API enabled).
 */

import { fetchWithRetry } from '@/lib/fetch-http';

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const GEOCODE_TIMEOUT_MS = 10000;

/** Map country name/label to Google Geocoding API region code (biasing). */
function getRegionCodeForCountry(country: string): string {
  const normalized = country.trim().toLowerCase();
  if (normalized.includes('brasil') || normalized === 'br') return 'br';
  if (normalized.includes('argentina') || normalized === 'ar') return 'ar';
  if (normalized.includes('méxico') || normalized.includes('mexico') || normalized === 'mx') return 'mx';
  if (normalized.includes('estados unidos') || normalized.includes('united states') || normalized === 'us') return 'us';
  if (normalized.includes('portugal') || normalized === 'pt') return 'pt';
  if (normalized.includes('espanha') || normalized.includes('spain') || normalized === 'es') return 'es';
  return 'br';
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(
  city: string,
  state?: string | null,
  country = 'Brasil'
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const parts = [city.trim()];
  if (state?.trim()) parts.push(state.trim());
  parts.push(country);
  const address = parts.join(', ');

  const regionCode = getRegionCodeForCountry(country);
  const url = new URL(GEOCODE_BASE);
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', regionCode);
  url.searchParams.set('language', 'pt-BR');

  const res = await fetchWithRetry(url.toString(), { method: 'GET' }, {
    timeoutMs: GEOCODE_TIMEOUT_MS,
    maxRetries: 2,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) return null;
  const loc = data.results[0].geometry.location;
  const lat = loc.lat;
  const lng = loc.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { latitude: lat, longitude: lng };
}
