import { expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { getLocaleStorageKey } from '@/lib/locale';

expect.extend(matchers);

beforeEach(() => {
    localStorage.setItem(getLocaleStorageKey(), 'pt');
    Object.defineProperty(navigator, 'language', {
        value: 'pt-BR',
        configurable: true,
        writable: true,
    });
    vi.stubGlobal(
        'fetch',
        vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/api/config/public')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({}),
                } as Response);
            }
            return Promise.reject(new Error(`Unmocked fetch in test: ${url}`));
        }),
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
