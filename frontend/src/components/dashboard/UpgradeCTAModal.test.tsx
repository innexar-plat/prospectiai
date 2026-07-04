import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UpgradeCTAModal } from './UpgradeCTAModal';

vi.mock('@/lib/billing-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing-config')>();
  return {
    ...actual,
    getNextUpgradePlan: vi.fn((plan: string) => {
      if (plan === 'FREE') return { key: 'BASIC', name: 'Starter', leadsLimit: 100, priceBrl: 99 };
      if (plan === 'BASIC') return { key: 'PRO', name: 'Profissional', leadsLimit: 300, priceBrl: 199 };
      return null;
    }),
    getPlanDisplayName: vi.fn((plan: string) => plan),
  };
});

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    getActiveMarket: vi.fn(() => 'BR'),
    getMarketConfig: vi.fn(() => ({ currency: 'BRL', appName: 'Prospector' })),
    US_STARTER_CREDITS: 100,
    US_STARTER_PRICE_USD: 19,
    resolveMarketLeadsLimit: vi.fn(() => 100),
  };
});

describe('UpgradeCTAModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props: Partial<Parameters<typeof UpgradeCTAModal>[0]> = {}) =>
    render(
      <MemoryRouter>
        <UpgradeCTAModal currentPlan="FREE" leadsUsed={10} leadsLimit={50} onClose={() => {}} {...props} />
      </MemoryRouter>
    );

  it('renders for free plan with upgrade info', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Starter/i)).toBeInTheDocument();
  });

  it('renders trial-specific title', () => {
    renderModal({ currentPlan: 'TRIAL', leadsUsed: 5, leadsLimit: 10 });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const closeBtn = screen.getByRole('dialog').querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const backdrop = document.querySelector('[class*="bg-black"]');
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when no next plan and not trial', () => {
    const { container } = render(
      <MemoryRouter>
        <UpgradeCTAModal currentPlan="SCALE" leadsUsed={10} leadsLimit={50} onClose={() => {}} />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('calls onClose when "later" button clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByText(/Depois/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
