import { prisma } from './prisma';
import { PlaceResult } from './google-places';

export async function syncLead(place: PlaceResult) {
    try {
        return await prisma.lead.upsert({
            where: { placeId: place.id },
            update: {
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                website: place.websiteUri,
                rating: place.rating,
                reviewCount: place.userRatingCount,
                types: place.types || [],
                businessStatus: place.businessStatus,
                lastSearchedAt: new Date(),
            },
            create: {
                placeId: place.id,
                name: place.displayName.text,
                address: place.formattedAddress,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
                website: place.websiteUri,
                rating: place.rating,
                reviewCount: place.userRatingCount,
                types: place.types || [],
                businessStatus: place.businessStatus,
            },
        });
    } catch (error) {
        const { logger } = await import('@/lib/logger');
        logger.error('Error syncing lead', { placeId: place.id, error: error instanceof Error ? error.message : 'Unknown' });
        return null;
    }
}

export async function syncLeads(places: PlaceResult[]) {
    return Promise.all(places.map(syncLead));
}
