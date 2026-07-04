import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrmSidePanel } from './CrmSidePanel';
import type { PlaceDetail, Analysis } from '@/lib/api';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: vi.fn(({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>{children}</a>
    )),
  };
});

vi.mock('@/lib/api', () => ({
  integrationsApi: {
    rdStationTest: vi.fn(() => Promise.resolve({ ok: true })),
    rdStationSources: vi.fn(() => Promise.resolve({ data: [] })),
    rdStationCampaigns: vi.fn(() => Promise.resolve({ data: [] })),
    rdStationSend: vi.fn(() => Promise.resolve({})),
    agendorTest: vi.fn(() => Promise.resolve({ ok: true })),
    agendorFunnels: vi.fn(() => Promise.resolve({ data: [] })),
    agendorUsers: vi.fn(() => Promise.resolve({ data: [] })),
    agendorDealStages: vi.fn(() => Promise.resolve({ data: [] })),
    agendorSend: vi.fn(() => Promise.resolve({})),
    hubspotTest: vi.fn(() => Promise.resolve({ ok: true })),
    hubspotPipelines: vi.fn(() => Promise.resolve({ data: [] })),
    hubspotOwners: vi.fn(() => Promise.resolve({ data: [] })),
    hubspotSend: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('@/lib/market', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/market')>();
  return {
    ...actual,
    isMarketFeatureEnabled: vi.fn(() => true),
  };
});

function buildPlace(): PlaceDetail {
  return {
    id: 'place-1',
    displayName: { text: 'Acme Inc' },
    formattedAddress: 'Av Paulista, 1000, São Paulo - SP, Brasil',
    nationalPhoneNumber: '+5511999999999',
    internationalPhoneNumber: '+5511999999999',
    websiteUri: 'https://acme.example',
    rating: 4.5,
    userRatingCount: 100,
    primaryType: 'restaurant',
    businessStatus: 'OPERATIONAL',
    googleMapsUri: 'https://goo.gl/maps/abc',
    website: 'https://acme.example',
  } as PlaceDetail;
}

function buildAnalysis(): Analysis {
  return {
    score: 85,
    scoreLabel: 'Alto Potencial',
    summary: 'Empresa bem avaliada',
    strengths: ['Boa localização'],
  } as Analysis;
}

describe('CrmSidePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CRM provider buttons', () => {
    render(
      <CrmSidePanel
        place={buildPlace()}
        analysis={buildAnalysis()}
        analyzing={false}
        onSuccess={() => {}}
        onError={() => {}}
        onWarning={() => {}}
      />
    );
    expect(screen.getByText('HubSpot')).toBeInTheDocument();
    expect(screen.getByText('RD Station')).toBeInTheDocument();
    expect(screen.getByText('Agendor')).toBeInTheDocument();
  });

  it('renders in embed mode without the title', () => {
    render(
      <CrmSidePanel
        place={buildPlace()}
        analysis={null}
        analyzing={false}
        onSuccess={() => {}}
        onError={() => {}}
        onWarning={() => {}}
        embed
      />
    );
    expect(screen.queryByText('Enviar para CRM')).not.toBeInTheDocument();
  });
});
