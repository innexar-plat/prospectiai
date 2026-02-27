/**
 * Search module — public API.
 * domain: types only. application: runSearch use-case.
 */

export {
    runSearch,
    runSearchAllPages,
    SEARCH_ALL_PAGES_MAX_PLACES,
    SearchHttpError,
} from './application/search.service';
export type { SearchAllPagesResult } from './application/search.service';
export type { SearchResult, PlaceLike } from './domain/types';
