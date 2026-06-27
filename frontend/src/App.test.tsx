import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

vi.mock('./pages/public/Landing', () => ({
  default: () => <main data-testid="landing-main">Landing</main>,
}));

vi.mock('./lib/api', () => ({
  authApi: { session: vi.fn().mockResolvedValue({ user: null }) },
  userApi: { me: vi.fn().mockResolvedValue({ user: null }) },
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders app and shows main content', async () => {
    render(
      <TestWrapper>
        <App />
      </TestWrapper>
    );
    const main = await screen.findByRole('main', {}, { timeout: 3000 });
    expect(main).toBeInTheDocument();
  });
});
