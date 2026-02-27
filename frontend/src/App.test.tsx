import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';

vi.mock('./lib/api', () => ({
  authApi: { session: vi.fn().mockResolvedValue({ user: null }) },
  userApi: { me: vi.fn().mockRejectedValue(new Error('unauthorized')) },
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
