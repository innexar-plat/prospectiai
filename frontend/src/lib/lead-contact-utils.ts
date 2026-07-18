import type { Place, PlaceDetail } from '@/lib/api';

export function inferDialCodeFromAddress(address?: string): string {
  const normalized = (address ?? '').toLowerCase();
  if (!normalized) return '55';

  if (/(estados unidos|united states|\busa\b|\bu\.s\.a\.?\b|\bu\.s\.?\b)/i.test(normalized)) return '1';
  if (/(mexico|méxico)/i.test(normalized)) return '52';
  if (/(argentina)/i.test(normalized)) return '54';
  if (/(colombia|colômbia)/i.test(normalized)) return '57';
  if (/(chile)/i.test(normalized)) return '56';
  if (/(peru|perú)/i.test(normalized)) return '51';
  if (/(portugal)/i.test(normalized)) return '351';
  if (/(espanha|españa|spain)/i.test(normalized)) return '34';
  if (/(brasil|brazil)/i.test(normalized)) return '55';

  return '55';
}

export function getPrimaryPhone(place: PlaceDetail | Place): string {
  if (place.phones && place.phones.length > 0) return place.phones[0]!;
  return place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? '';
}

export function buildWhatsAppNumber(place: PlaceDetail | Place): string | null {
  const internationalDigits = (place.internationalPhoneNumber ?? '').replace(/\D/g, '');
  if (internationalDigits) return internationalDigits.startsWith('00') ? internationalDigits.slice(2) : internationalDigits;

  const nationalDigits = (place.nationalPhoneNumber ?? '').replace(/\D/g, '');
  if (!nationalDigits) {
    const fromList = (place.phones?.[0] ?? '').replace(/\D/g, '');
    if (!fromList) return null;
    const dialCode = inferDialCodeFromAddress(place.formattedAddress);
    return fromList.startsWith(dialCode) ? fromList : `${dialCode}${fromList}`;
  }

  const phoneDigits = nationalDigits.startsWith('00') ? nationalDigits.slice(2) : nationalDigits;
  const dialCode = inferDialCodeFromAddress(place.formattedAddress);
  return phoneDigits.startsWith(dialCode) ? phoneDigits : `${dialCode}${phoneDigits}`;
}

export function buildMapsUrl(address?: string): string | null {
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function getPrimaryEmail(place: PlaceDetail | Place): string | null {
  const rfEmail = place.rfData?.email ?? null;
  const all = [place.email, rfEmail, ...(place.emails ?? [])].filter(Boolean) as string[];
  return all[0] ?? null;
}

export function buildMailtoUrl(options: {
  to?: string | null;
  subject?: string;
  body?: string;
}): string | null {
  const to = options.to?.trim();
  if (!to && !options.subject && !options.body) return null;

  const params = new URLSearchParams();
  if (options.subject) params.set('subject', options.subject);
  if (options.body) params.set('body', options.body);
  const query = params.toString();

  if (to) {
    return query ? `mailto:${to}?${query}` : `mailto:${to}`;
  }
  return query ? `mailto:?${query}` : null;
}
