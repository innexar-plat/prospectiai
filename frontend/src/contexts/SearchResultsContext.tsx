/**
 * Holds the last search results so the list persists when navigating to a lead and back.
 * Cleared only when the user runs a new search.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Place } from '@/lib/api';

export interface LastSearchParams {
  textQuery: string;
  includedType?: string;
  city?: string;
  state?: string;
  radiusKm?: number;
  hasWebsite?: string;
  hasPhone?: string;
}

export interface LastSearchResults {
  places: Place[];
  nextPageToken?: string;
  params: LastSearchParams;
}

interface SearchResultsContextValue {
  lastSearchResults: LastSearchResults | null;
  setLastSearchResults: (results: LastSearchResults | null) => void;
  appendSearchResults: (newPlaces: Place[], nextPageToken?: string) => void;
}

const SearchResultsContext = createContext<SearchResultsContextValue | null>(null);

export function SearchResultsProvider({ children }: { children: React.ReactNode }) {
  const [lastSearchResults, setLastSearchResultsState] = useState<LastSearchResults | null>(null);

  const setLastSearchResults = useCallback((results: LastSearchResults | null) => {
    setLastSearchResultsState(results);
  }, []);

  const appendSearchResults = useCallback((newPlaces: Place[], nextPageToken?: string) => {
    setLastSearchResultsState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        places: [...prev.places, ...newPlaces],
        nextPageToken,
      };
    });
  }, []);

  const value = useMemo<SearchResultsContextValue>(
    () => ({
      lastSearchResults,
      setLastSearchResults,
      appendSearchResults,
    }),
    [lastSearchResults, setLastSearchResults, appendSearchResults]
  );

  return (
    <SearchResultsContext.Provider value={value}>
      {children}
    </SearchResultsContext.Provider>
  );
}

export function useSearchResults(): SearchResultsContextValue {
  const ctx = useContext(SearchResultsContext);
  if (!ctx) {
    throw new Error('useSearchResults must be used within SearchResultsProvider');
  }
  return ctx;
}
