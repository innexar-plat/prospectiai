/**
 * Search module — domain types.
 * Pure types; no infra or application imports.
 */

export type SearchResult = {
    places?: PlaceResult[];
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

export type PlaceResult = PlaceLike & {
    id: string;
    displayName: { text: string; languageCode?: string };
    formattedAddress?: string;
    googleMapsUri?: string;
    email?: string;
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    businessStatus?: string;
    primaryType?: string;
    primaryTypeDisplayName?: { text: string };
    cnpj?: string;
    companyLegalName?: string;
    companyTradeName?: string;
    companyMainCnae?: string;
    cnpjStatus?: string;
    recommendedPhone?: string;
    recommendedEmail?: string;
    recommendedWebsite?: string;
    contactsHealthScore?: number;
    /** All unique phones collected from every source (Google, RF, BrasilAPI, Lead DB). */
    phones?: string[];
    /** All unique emails collected from every source. */
    emails?: string[];
    /** All unique websites collected from every source. */
    websites?: string[];
};
