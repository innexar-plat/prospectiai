import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TrialBanner } from './TrialBanner';
import type { SessionUser } from '@/lib/api';

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    isTrialEnabled: vi.fn(() => true),
  };
});

vi.mock('@/lib/billing-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing-config')>();
  return {
    ...actual,
    isTrialExpiredUser: vi.fn((user: { plan: string }) => user.plan === 'TRIAL_EXPIRED'),
    isTrialingUser: vi.fn((user: SessionUser) => user.plan === 'TRIAL' && (user.trialDaysRemaining ?? 0) > 0),
  };
});

function buildUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    plan: 'TRIAL',
    leadsUsed: 5,
    leadsLimit: 20,
    trialDaysRemaining: 10,
    companyName: 'Acme',
    productService: '',
    targetAudience: '',
    mainBenefit: '',
    city: '',
    state: '',
    cnpj: null,
    websiteUrl: null,
    serviceModel: null,
    averageTicket: null,
    ...overrides,
  } as SessionUser;
}

describe('TrialBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active trial banner', () => {
    render(<MemoryRouter><TrialBanner user={buildUser()} /></MemoryRouter>);
    expect(screen.getByText(/assinar agora/i)).toBeInTheDocument();
    expect(screen.getByText(/TRIAL/i)).toBeInTheDocument();
  });

  it('renders expired trial banner', () => {
    const user = buildUser({ plan: 'TRIAL_EXPIRED' as never, trialDaysRemaining: 0 });
    render(<MemoryRouter><TrialBanner user={user} /></MemoryRouter>);
    expect(screen.getByText(/ver planos/i)).toBeInTheDocument();
  });

  it('returns null for non-trial plans', () => {
    const { container } = render(<MemoryRouter><TrialBanner user={buildUser({ plan: 'PRO' })} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when trial is disabled', async () => {
    const { isTrialEnabled } = await import('@/lib/market');
    vi.mocked(isTrialEnabled).mockReturnValue(false);
    const { container } = render(<MemoryRouter><TrialBanner user={buildUser()} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
});
