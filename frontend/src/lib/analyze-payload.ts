import type { Place, PlaceDetail } from '@/lib/api';
import { normalizeAnalyzeLocale } from '@/lib/locale';

export function buildAnalyzePayload(place: PlaceDetail | Place, locale: string) {
  return {
    placeId: place.id,
    name: place.displayName?.text ?? place.id,
    locale: normalizeAnalyzeLocale(locale),
    websiteUri: place.websiteUri ?? undefined,
    website: place.website ?? undefined,
    formattedAddress: place.formattedAddress ?? undefined,
    nationalPhoneNumber: place.nationalPhoneNumber ?? undefined,
    internationalPhoneNumber: place.internationalPhoneNumber ?? undefined,
    rating: place.rating ?? undefined,
    userRatingCount: place.userRatingCount ?? undefined,
    types: place.types ?? undefined,
    primaryType: place.primaryType ?? undefined,
    businessStatus: place.businessStatus ?? undefined,
    reviews: place.reviews ?? undefined,
    currentOpeningHours: place.currentOpeningHours ?? undefined,
  };
}
