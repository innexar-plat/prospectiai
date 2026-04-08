import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SearchResultsProvider, useSearchResults } from '@/contexts/SearchResultsContext';

function Consumer() {
  const { lastSearchResults, setLastSearchResults, appendSearchResults } = useSearchResults();
  return (
    <div>
      <span data-testid="count">{lastSearchResults?.places.length ?? 0}</span>
      <button
        type="button"
        onClick={() =>
          setLastSearchResults({
            places: [{ id: 'p1', displayName: { text: 'A' } }],
            params: { textQuery: 'x' },
          })
        }
      >
        Set
      </button>
      <button
        type="button"
        onClick={() => appendSearchResults([{ id: 'p2', displayName: { text: 'B' } } as never])}
      >
        Append
      </button>
    </div>
  );
}

describe('SearchResultsContext', () => {
  it('provides null initially', () => {
    render(
      <SearchResultsProvider>
        <Consumer />
      </SearchResultsProvider>
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('updates when setLastSearchResults called', async () => {
    render(
      <SearchResultsProvider>
        <Consumer />
      </SearchResultsProvider>
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Set' }).click();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('appendSearchResults appends to existing results', async () => {
    render(
      <SearchResultsProvider>
        <Consumer />
      </SearchResultsProvider>
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Set' }).click();
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Append' }).click();
    });
    expect(screen.getByTestId('count').textContent).toBe('2');
  });
});
