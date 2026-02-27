/**
 * Search module — domain types.
 * Pure types; no infra or application imports.
 */

export type SearchResult = {
    places?: unknown[];
    nextPageToken?: string;
    fromCache?: boolean;
    fromLocalDb?: boolean;
};

export type PlaceLike = {
    websiteUri?: string | null;
    website?: string | null;
    nationalPhoneNumber?: string | null;
    internationalPhoneNumber?: string | null;
    phone?: string | null;
};
