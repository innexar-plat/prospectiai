/**
 * Holds the last search results so the list persists when navigating to a lead and back.
 * Cleared only when the user runs a new search.
 * Persisted to sessionStorage so results survive page refreshes within the same tab.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Place } from '@/lib/api';

export interface LastSearchParams {
  textQuery: string;
  includedType?: string;
  city?: string;
  state?: string;
  country?: string;
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

const SESSION_KEY = 'prospector:lastSearch';

function loadFromSession(): LastSearchResults | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastSearchResults;
  } catch {
    return null;
  }
}

function saveToSession(results: LastSearchResults | null): void {
  try {
    if (results === null) {
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(results));
    }
  } catch {
    // sessionStorage might be unavailable (private mode restrictions)
  }
}

const SearchResultsContext = createContext<SearchResultsContextValue | null>(null);

export function SearchResultsProvider({ children }: { children: React.ReactNode }) {
  const [lastSearchResults, setLastSearchResultsState] = useState<LastSearchResults | null>(loadFromSession);

  const setLastSearchResults = useCallback((results: LastSearchResults | null) => {
    setLastSearchResultsState(results);
    saveToSession(results);
  }, []);

  const appendSearchResults = useCallback((newPlaces: Place[], nextPageToken?: string) => {
    setLastSearchResultsState((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        places: [...prev.places, ...newPlaces],
        nextPageToken,
      };
      saveToSession(updated);
      return updated;
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

// Hook exported from same file as provider; allow for react-refresh
// eslint-disable-next-line react-refresh/only-export-components
export function useSearchResults(): SearchResultsContextValue {
  const ctx = useContext(SearchResultsContext);
  if (!ctx) {
    throw new Error('useSearchResults must be used within SearchResultsProvider');
  }
  return ctx;
}
