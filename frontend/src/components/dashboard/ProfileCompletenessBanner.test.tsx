import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderWithI18n } from '@/test/render-with-i18n';
import { getLocaleStorageKey } from '@/lib/locale';
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
    expect(result.missingKeys).toContain('common.profile.field.targetAudience');
    expect(result.missingKeys).toContain('common.profile.field.cnpjOrWebsite');
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
    const locale = localStorage.getItem(getLocaleStorageKey());
    localStorage.clear();
    if (locale) localStorage.setItem(getLocaleStorageKey(), locale);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders for incomplete profiles and triggers primary action', () => {
    const onPrimaryAction = vi.fn();
    renderWithI18n(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={onPrimaryAction} />);

    expect(screen.getByText(/perfil estratégico incompleto/i)).toBeInTheDocument();
    expect(screen.getByText(/faltando:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /completar perfil/i }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('does not render for complete-enough profiles', () => {
    renderWithI18n(
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
    renderWithI18n(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /fechar aviso/i }));

    expect(screen.queryByText(/perfil estratégico incompleto/i)).not.toBeInTheDocument();
    expect(setItemSpy).toHaveBeenCalledWith(
      'profile-completeness-banner-dismissed-at',
      expect.any(String),
    );
  });

  it('stays hidden when dismissed recently', () => {
    localStorage.setItem('profile-completeness-banner-dismissed-at', String(Date.now()));

    renderWithI18n(<ProfileCompletenessBanner user={buildUser()} onPrimaryAction={() => {}} />);

    expect(screen.queryByText(/perfil estratégico incompleto/i)).not.toBeInTheDocument();
  });
});