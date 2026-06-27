import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmailCampaignsPage } from '@/pages/EmailCampaignsPage';
import { EmailCampaignDetailPage } from '@/pages/EmailCampaignDetailPage';
import { EmailTemplatesPage } from '@/pages/EmailTemplatesPage';
import { EmailTemplateEditorPage } from '@/pages/EmailTemplateEditorPage';
import { EmailAnalyticsPage } from '@/pages/EmailAnalyticsPage';
import { WeeklyReportConfigPage } from '@/pages/WeeklyReportConfigPage';
import { CrmIntegrationsPage } from '@/pages/CrmIntegrationsPage';
import { AutoProspeccaoTemplatesPage } from '@/pages/AutoProspeccaoTemplatesPage';
import { AutoProspeccaoTemplateEditorPage } from '@/pages/AutoProspeccaoTemplateEditorPage';
import { AutoProspeccaoSearchProfilesPage } from '@/pages/AutoProspeccaoSearchProfilesPage';
import { AutoProspeccaoSenderPoolPage } from '@/pages/AutoProspeccaoSenderPoolPage';
import { AutoProspeccaoConfigPage } from '@/pages/AutoProspeccaoConfigPage';

const mockCampaignsList = vi.fn();
const mockCampaignGet = vi.fn();
const mockCampaignRecipients = vi.fn();
const mockTemplatesList = vi.fn();
const mockTemplateGet = vi.fn();
const mockEmailStats = vi.fn();
const mockWeeklyReportGet = vi.fn();
const mockCrmGetConfig = vi.fn();
const mockAgendorObs = vi.fn();
const mockHubspotObs = vi.fn();
const mockAutoTemplatesList = vi.fn();
const mockAutoTemplateGet = vi.fn();
const mockAutoSearchProfilesList = vi.fn();
const mockWorkspaces = vi.fn();
const mockSenderPoolList = vi.fn();
const mockAutoConfigGet = vi.fn();

vi.mock('@/lib/api', () => ({
  emailMarketingApi: {
    stats: () => mockEmailStats(),
    campaigns: {
      list: (...args: unknown[]) => mockCampaignsList(...args),
      get: (...args: unknown[]) => mockCampaignGet(...args),
      recipients: (...args: unknown[]) => mockCampaignRecipients(...args),
    },
    templates: {
      list: (...args: unknown[]) => mockTemplatesList(...args),
      get: (...args: unknown[]) => mockTemplateGet(...args),
    },
    weeklyReport: {
      get: () => mockWeeklyReportGet(),
    },
  },
  adminApi: {
    workspaces: (...args: unknown[]) => mockWorkspaces(...args),
    crmConfig: {
      getConfig: (...args: unknown[]) => mockCrmGetConfig(...args),
    },
    agendorObservability: { get: () => mockAgendorObs() },
    hubspotObservability: { get: () => mockHubspotObs() },
  },
  autoProspeccaoAdminApi: {
    templates: {
      list: (...args: unknown[]) => mockAutoTemplatesList(...args),
      get: (...args: unknown[]) => mockAutoTemplateGet(...args),
    },
    searchProfiles: {
      list: (...args: unknown[]) => mockAutoSearchProfilesList(...args),
    },
    senderPool: {
      list: (...args: unknown[]) => mockSenderPoolList(...args),
    },
    config: {
      get: (...args: unknown[]) => mockAutoConfigGet(...args),
    },
  },
}));

const emptyWorkspaces = { items: [], total: 0, limit: 100, offset: 0 };

const mockCampaign = {
  id: 'c1',
  name: 'Campanha Teste',
  templateId: 't1',
  template: { id: 't1', name: 'Tpl', slug: 'tpl', type: 'PROMOTION', subject: 'Hi' },
  audience: 'ALL',
  status: 'DRAFT',
  totalRecipients: 0,
  totalSent: 0,
  totalFailed: 0,
  createdAt: '',
  updatedAt: '',
};

const mockEmailTemplate = {
  id: 't1',
  name: 'Template',
  slug: 'template',
  type: 'PROMOTION',
  status: 'DRAFT',
  subject: 'Subject',
  body: { paragraphs: ['Hello'] },
  createdAt: '',
  updatedAt: '',
};

const mockAutoTemplate = {
  id: 'at1',
  name: 'Auto Template',
  type: 'HOT_COLD_INTRO',
  subject: 'Subject',
  preheader: null,
  bodyHtml: '<p>Hi</p>',
  bodyText: null,
  targetCnae: null,
  targetSegment: null,
  isSystem: true,
  workspaceId: null,
  createdAt: '',
  updatedAt: '',
};

function renderAt(path: string, routePath: string, element: ReactNode) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin pages smoke tests (previously untested)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignsList.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    mockTemplatesList.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 });
    mockEmailStats.mockResolvedValue({
      totalTemplates: 0,
      activeTemplates: 0,
      totalCampaigns: 0,
      totalSent: 0,
      totalFailed: 0,
      recentCampaigns: 0,
    });
    mockWeeklyReportGet.mockResolvedValue({
      data: {
        id: 'wr1',
        enabled: true,
        sendDay: 1,
        sendHour: 8,
        updatedAt: '',
      },
    });
    mockCrmGetConfig.mockResolvedValue({
      configured: false,
      provider: 'rdstation',
      clientId: '',
      hasClientSecret: false,
    });
    mockAgendorObs.mockResolvedValue({
      connectedUsers: 0,
      totalUsers: 0,
      percentConnected: 0,
      usesEnvFallback: false,
    });
    mockHubspotObs.mockResolvedValue({
      connectedUsers: 0,
      totalUsers: 0,
      percentConnected: 0,
    });
    mockAutoTemplatesList.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
    });
    mockAutoSearchProfilesList.mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 100, totalPages: 0 },
    });
    mockWorkspaces.mockResolvedValue(emptyWorkspaces);
    mockCampaignGet.mockResolvedValue({ data: mockCampaign });
    mockCampaignRecipients.mockResolvedValue({ items: [], total: 0 });
    mockTemplateGet.mockResolvedValue({ data: mockEmailTemplate });
    mockAutoTemplateGet.mockResolvedValue({ data: mockAutoTemplate });
  });

  it('EmailCampaignsPage renders heading', async () => {
    renderAt('/email-campaigns', '/email-campaigns', <EmailCampaignsPage />);
    expect(await screen.findByRole('heading', { name: /campanhas de email/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('EmailCampaignDetailPage renders campaign name', async () => {
    renderAt('/email-campaigns/c1', '/email-campaigns/:id', <EmailCampaignDetailPage />);
    expect(await screen.findByRole('heading', { name: /campanha teste/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('EmailTemplatesPage renders heading', async () => {
    renderAt('/email-templates', '/email-templates', <EmailTemplatesPage />);
    expect(await screen.findByRole('heading', { name: /templates de email/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('EmailTemplateEditorPage renders heading', async () => {
    renderAt('/email-templates/t1', '/email-templates/:id', <EmailTemplateEditorPage />);
    expect(await screen.findByRole('heading', { name: /editar template/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('EmailAnalyticsPage renders heading', async () => {
    renderAt('/email-analytics', '/email-analytics', <EmailAnalyticsPage />);
    expect(await screen.findByRole('heading', { name: /email analytics/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('WeeklyReportConfigPage renders heading', async () => {
    renderAt('/email-weekly-report', '/email-weekly-report', <WeeklyReportConfigPage />);
    expect(await screen.findByRole('heading', { name: /relatório semanal/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('CrmIntegrationsPage renders heading', async () => {
    renderAt('/crm-integrations', '/crm-integrations', <CrmIntegrationsPage />);
    expect(await screen.findByRole('heading', { name: /integrações crm/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('AutoProspeccaoTemplatesPage renders heading', async () => {
    renderAt('/auto-prospeccao/templates', '/auto-prospeccao/templates', <AutoProspeccaoTemplatesPage />);
    expect(await screen.findByRole('heading', { name: /templates de email — auto-prospecção/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('AutoProspeccaoTemplateEditorPage renders new template heading', async () => {
    renderAt('/auto-prospeccao/templates/new', '/auto-prospeccao/templates/:id', <AutoProspeccaoTemplateEditorPage />);
    expect(await screen.findByRole('heading', { name: /novo template/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('AutoProspeccaoSearchProfilesPage renders heading', async () => {
    renderAt('/auto-prospeccao/search-profiles', '/auto-prospeccao/search-profiles', <AutoProspeccaoSearchProfilesPage />);
    expect(await screen.findByRole('heading', { name: /perfis de busca — auto-prospecção/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('AutoProspeccaoSenderPoolPage renders heading', async () => {
    renderAt('/auto-prospeccao/sender-pool', '/auto-prospeccao/sender-pool', <AutoProspeccaoSenderPoolPage />);
    expect(await screen.findByRole('heading', { name: /pool de remetentes/i }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('AutoProspeccaoConfigPage renders heading', async () => {
    renderAt('/auto-prospeccao/config', '/auto-prospeccao/config', <AutoProspeccaoConfigPage />);
    expect(await screen.findByRole('heading', { name: /configuração do módulo/i }, { timeout: 3000 })).toBeInTheDocument();
  });
});
