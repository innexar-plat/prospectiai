import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { EmailCampaignDetailPage } from '@/pages/EmailCampaignDetailPage';
import { EmailTemplateEditorPage } from '@/pages/EmailTemplateEditorPage';
import { AutoProspeccaoTemplateEditorPage } from '@/pages/AutoProspeccaoTemplateEditorPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCampaignGet = vi.fn();
const mockCampaignRecipients = vi.fn();
const mockTemplateGet = vi.fn();

vi.mock('@/lib/api', () => ({
  emailMarketingApi: {
    campaigns: {
      get: (...args: unknown[]) => mockCampaignGet(...args),
      recipients: (...args: unknown[]) => mockCampaignRecipients(...args),
    },
    templates: {
      get: (...args: unknown[]) => mockTemplateGet(...args),
    },
  },
  autoProspeccaoAdminApi: {
    templates: { get: vi.fn() },
  },
}));

describe('Admin detail pages use relative navigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCampaignGet.mockResolvedValue({
      data: {
        id: 'c1',
        name: 'Campanha',
        templateId: 't1',
        template: { id: 't1', name: 'Tpl', slug: 'tpl', type: 'PROMOTION', subject: 'Hi' },
        audience: 'ALL',
        status: 'DRAFT',
        totalRecipients: 0,
        totalSent: 0,
        totalFailed: 0,
        createdAt: '',
        updatedAt: '',
      },
    });
    mockCampaignRecipients.mockResolvedValue({ items: [], total: 0 });
    mockTemplateGet.mockResolvedValue({
      data: {
        id: 't1',
        name: 'Template',
        slug: 'template',
        type: 'PROMOTION',
        status: 'DRAFT',
        subject: 'Subject',
        body: { paragraphs: ['Hello'] },
        createdAt: '',
        updatedAt: '',
      },
    });
  });

  it('EmailCampaignDetailPage back button navigates relatively', async () => {
    render(
      <MemoryRouter initialEntries={['/email-campaigns/c1']}>
        <Routes>
          <Route path="/email-campaigns/:id" element={<EmailCampaignDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /campanha/i }, { timeout: 3000 });
    const backButtons = document.querySelectorAll('button');
    fireEvent.click(backButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('..');
  });

  it('EmailTemplateEditorPage back button navigates relatively', async () => {
    render(
      <MemoryRouter initialEntries={['/email-templates/t1']}>
        <Routes>
          <Route path="/email-templates/:id" element={<EmailTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /editar template/i }, { timeout: 3000 });
    const backButtons = document.querySelectorAll('button');
    fireEvent.click(backButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('..');
  });

  it('AutoProspeccaoTemplateEditorPage back button navigates relatively', async () => {
    render(
      <MemoryRouter initialEntries={['/auto-prospeccao/templates/new']}>
        <Routes>
          <Route path="/auto-prospeccao/templates/:id" element={<AutoProspeccaoTemplateEditorPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: /novo template/i }, { timeout: 3000 });
    const backButtons = document.querySelectorAll('button');
    fireEvent.click(backButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('..');
  });
});
