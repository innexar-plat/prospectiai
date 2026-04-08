/**
 * Geocoding via Google Geocoding API.
 * Resolves city/state/country to lat/lng for Places API locationBias.
 * Center = cidade; raio (escolhido no UI em km) é aplicado a partir desse centro.
 * Uses GOOGLE_PLACES_API_KEY (same key can have Geocoding API enabled).
 */

import { fetchWithRetry } from '@/lib/fetch-http';
import { resolveCountryLocale } from '@/lib/country-locale';

const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';
const GEOCODE_TIMEOUT_MS = 15000;

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

  const locale = resolveCountryLocale(country);

  const parts = [city.trim()];
  if (state?.trim()) parts.push(state.trim());
  parts.push(country);
  const address = parts.join(', ');

  const url = new URL(GEOCODE_BASE);
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', locale.regionCode.toLowerCase());
  url.searchParams.set('language', locale.languageCode);

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
