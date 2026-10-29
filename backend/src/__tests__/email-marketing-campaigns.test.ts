const mockCount = jest.fn().mockResolvedValue(0);
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();
const mockCampaignUpdate = jest.fn().mockResolvedValue({});
const mockRecipientCreateMany = jest.fn().mockResolvedValue({});
const mockRecipientUpdateMany = jest.fn().mockResolvedValue({});
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { count: (...a: unknown[]) => mockCount(...a), findMany: (...a: unknown[]) => mockFindMany(...a) },
        emailCampaign: { findUnique: (...a: unknown[]) => mockFindUnique(...a), update: (...a: unknown[]) => mockCampaignUpdate(...a) },
        emailUnsubscribe: { findMany: jest.fn().mockResolvedValue([]) },
        emailCampaignRecipient: { createMany: (...a: unknown[]) => mockRecipientCreateMany(...a), updateMany: (...a: unknown[]) => mockRecipientUpdateMany(...a) },
        emailSendLog: { create: jest.fn().mockResolvedValue({}) },
    },
}));
const mockSend = jest.fn().mockResolvedValue({ sent: true });
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => mockSend(...a) }));
const mockSlot = jest.fn();
jest.mock('@/lib/marketing-cap', () => ({ claimMarketingSlot: (...a: unknown[]) => mockSlot(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { resolveAudience, sendCampaign, renderTemplatePreview } from '@/modules/email-marketing';

beforeEach(() => jest.clearAllMocks());

describe('campaign audiences', () => {
    it('CHURNED means lost customers, never disabled accounts', async () => {
        await resolveAudience('CHURNED');
        const where = mockCount.mock.calls[0][0].where;
        expect(where.disabledAt).toBeNull();
        expect(where.notifyByEmail).toBe(true);
        expect(where.workspaces.some.workspace.subscriptionStatus.in).toContain('trial_expired');
    });

    it('INACTIVE uses search activity instead of profile updates', async () => {
        await resolveAudience('INACTIVE', { inactiveDays: 14 });
        const where = mockCount.mock.calls[0][0].where;
        expect(where.updatedAt).toBeUndefined();
        expect(where.searchHistory.none.createdAt.gte).toBeInstanceOf(Date);
    });
});

describe('sendCampaign', () => {
    const template = { type: 'PROMOTION', subject: 'Oi {{firstName}}', body: { paragraphs: ['Novidades'] }, ctaLabel: 'Ver', ctaUrl: 'https://precisionia.com.br/dashboard' };

    it('skips users inside the marketing frequency cap and adds the unsubscribe token', async () => {
        mockFindUnique.mockResolvedValueOnce({ id: 'c1', status: 'SCHEDULED', audience: 'ALL', audienceFilter: null, template })
            .mockResolvedValue({ status: 'SENDING' });
        mockFindMany.mockResolvedValueOnce([{ id: 'u1', email: 'a@x.com', name: 'Ana Lima' }, { id: 'u2', email: 'b@x.com', name: 'Bia' }]);
        mockSlot.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        await sendCampaign('c1');

        expect(mockSend).toHaveBeenCalledTimes(1);
        expect(mockSend.mock.calls[0][0]).toBe('a@x.com');
        expect(mockSend.mock.calls[0][1]).toBe('Oi Ana');
        expect(mockSend.mock.calls[0][2]).toContain('unsubscribe?token=u1');
        expect(mockRecipientUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { campaignId: 'c1', userId: 'u2' }, data: expect.objectContaining({ error: 'frequency_cap' }) }));
    });
});

describe('renderTemplatePreview', () => {
    it('renders the brand name variable as Precision IA', () => {
        const html = renderTemplatePreview({ type: 'PROMOTION', subject: 'S', body: { paragraphs: ['Bem-vindo ao {{appName}}'] } }, 'Ana');
        expect(html).toContain('Bem-vindo ao Precision IA');
    });
});
