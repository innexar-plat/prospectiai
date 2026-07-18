import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVersionCheck } from '../useVersionCheck';

vi.mock('@/lib/version', () => ({
  APP_VERSION: '2.2.0',
  BUILD_TIME: '2026-01-01T00:00:00.000Z',
}));

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns updateAvailable as false initially', () => {
    const { result } = renderHook(() => useVersionCheck());
    expect(result.current.updateAvailable).toBe(false);
  });

  it('sets updateAvailable to true when version mismatches', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.3.0' }),
    } as Response);

    const { result } = renderHook(() => useVersionCheck());
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });
    await vi.waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });
  });

  it('keeps updateAvailable as false when version and buildTime match', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.2.0', buildTime: '2026-01-01T00:00:00.000Z' }),
    } as Response);

    const { result } = renderHook(() => useVersionCheck());
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('sets updateAvailable to true on a buildTime mismatch even when version string is unchanged (regression: a deploy without a manual version bump must still be detected)', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ version: '2.2.0', buildTime: '2026-06-01T00:00:00.000Z' }),
    } as Response);

    const { result } = renderHook(() => useVersionCheck());
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });
    await vi.waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });
  });

  it('does not set updateAvailable on fetch error', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useVersionCheck());
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('does not set updateAvailable on non-ok response', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
    } as Response);

    const { result } = renderHook(() => useVersionCheck());
    await act(async () => {
      vi.advanceTimersByTime(31000);
    });
    expect(result.current.updateAvailable).toBe(false);
  });

  it('calls fetch on window focus', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.2.0' }),
    } as Response);

    renderHook(() => useVersionCheck());
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(mockFetch).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
  });

  it('checks periodically every 5 minutes', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.2.0' }),
    } as Response);

    renderHook(() => useVersionCheck());
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(300000); });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('reload function clears SW and reloads', () => {
    const { result } = renderHook(() => useVersionCheck());
    const location = window.location;
    const reloadFn = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...location, reload: reloadFn },
      writable: true,
    });
    act(() => {
      result.current.reload();
    });
    expect(reloadFn).toHaveBeenCalledTimes(1);
    Object.defineProperty(window, 'location', {
      value: location,
      writable: true,
    });
  });

  it('cleans up timers on unmount', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.2.0' }),
    } as Response);

    const { unmount } = renderHook(() => useVersionCheck());
    unmount();
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
