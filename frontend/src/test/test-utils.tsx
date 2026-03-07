/* eslint-disable react-refresh/only-export-components -- test utils: exports helpers and wrapper */
import React from 'react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

function AllProviders({ children, route = '/' }: { children: React.ReactNode; route?: string }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          {children}
        </MemoryRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
) {
  const { route = '/', ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => <AllProviders route={route}>{children}</AllProviders>,
    ...renderOptions,
  });
}

export type MockFetchResponse =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; data?: unknown };

export function createMockFetch(responses: MockFetchResponse[] = []) {
  const queue = [...responses];
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    void url;
    void init;
    const next = queue.shift();
    if (!next) {
      return Promise.resolve({
        ok: false,
        status: 500,
        statusText: 'No mock',
        json: () => Promise.resolve({ error: 'No mock response' }),
      } as Response);
    }
    if (next.ok) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(next.data),
      } as Response);
    }
    return Promise.resolve({
      ok: false,
      status: next.status ?? 400,
      statusText: 'Error',
      json: () => Promise.resolve(next.data ?? { error: 'Error' }),
    } as Response);
  });
}
