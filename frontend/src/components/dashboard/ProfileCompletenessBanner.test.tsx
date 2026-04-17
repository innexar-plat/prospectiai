import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ProfileCompletenessBanner } from './ProfileCompletenessBanner';
import { getProfileCompleteness } from '@/lib/profile-completeness';
import type { SessionUser } from '@/lib/api';

function buildUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    plan: 'PRO',
    leadsUsed: 10,
    leadsLimit: 100,
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
  };
}

describe('getProfileCompleteness', () => {
  it('calculates percentage and missing fields', () => {
    const result = getProfileCompleteness(
      buildUser({
        productService: 'Consultoria',
        city: 'Santos',
      }),
    );

    expect(result.percent).toBe(38);
    expect(result.isCompleteEnough).toBe(false);
    expect(result.missing).toContain('público-alvo');
    expect(result.missing).toContain('CNPJ ou site');
  });

  it('marks profile as complete enough when the threshold is reached', () => {
    const result = getProfileCompleteness(
      buildUser({
        productService: 'Consultoria',
        targetAudience: 'PMEs',
        mainBenefit: 'Mais vendas',
        city: 'Santos',
        state: 'SP',
        websiteUrl: 'https://acme.example',
      }),
    );

    expect(result.isCompleteEnough).toBe(true);
    expect(result.percent).toBe(88);
  });
});

describe('ProfileCompletenessBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders for incomplete profiles and triggers primary action', () => {
    const onPrimaryAction = vi.fn();
    render(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={onPrimaryAction} />);

    expect(screen.getByText(/perfil estratégico incompleto/i)).toBeInTheDocument();
    expect(screen.getByText(/faltando:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /completar perfil/i }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('does not render for complete-enough profiles', () => {
    render(
      <ProfileCompletenessBanner
        user={buildUser({
          productService: 'Consultoria',
          targetAudience: 'PMEs',
          mainBenefit: 'Mais vendas',
          city: 'Santos',
          state: 'SP',
          cnpj: '12345678000199',
        })}
        onPrimaryAction={() => {}}
      />,
    );

    expect(screen.queryByText(/perfil estratégico incompleto/i)).not.toBeInTheDocument();
  });

  it('dismisses and stores timestamp in localStorage', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /fechar aviso/i }));

    expect(screen.queryByText(/perfil estratégico incompleto/i)).not.toBeInTheDocument();
    expect(setItemSpy).toHaveBeenCalledWith(
      'profile-completeness-banner-dismissed-at',
      expect.any(String),
    );
  });

  it('stays hidden when dismissed recently', () => {
    localStorage.setItem('profile-completeness-banner-dismissed-at', String(Date.now()));

    render(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={() => {}} />);

    expect(screen.queryByText(/perfil estratégico incompleto/i)).not.toBeInTheDocument();
  });
});