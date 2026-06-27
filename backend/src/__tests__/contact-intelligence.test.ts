import { buildContactIntelligenceByLeadId, setPrimaryContact } from '@/lib/contact-intelligence';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    leadContact: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('contact-intelligence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds recommendations and aggregates global risk flags', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'lead_1',
      placeId: 'ChIJ_1',
      cnpj: '12345678000190',
    });

    (prisma.leadContact.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'phone_1',
        leadId: 'lead_1',
        type: 'PHONE',
        source: 'GOOGLE',
        roleHint: 'UNKNOWN',
        valueRaw: '+55 11 98888-7777',
        valueNormalized: '5511988887777',
        confidenceScore: 70,
        isPrimary: true,
        evidence: null,
        firstSeenAt: new Date('2026-04-10T12:00:00.000Z'),
        lastSeenAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
      {
        id: 'website_1',
        leadId: 'lead_1',
        type: 'WEBSITE',
        source: 'GOOGLE',
        roleHint: 'UNKNOWN',
        valueRaw: 'https://empresa.com',
        valueNormalized: 'empresa.com',
        confidenceScore: 70,
        isPrimary: true,
        evidence: null,
        firstSeenAt: new Date('2026-04-10T12:00:00.000Z'),
        lastSeenAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
      {
        id: 'email_1',
        leadId: 'lead_1',
        type: 'EMAIL',
        source: 'MANUAL',
        roleHint: 'OWNER',
        valueRaw: 'contato@empresa.com',
        valueNormalized: 'contato@empresa.com',
        confidenceScore: 90,
        isPrimary: true,
        evidence: null,
        firstSeenAt: new Date('2026-04-10T12:00:00.000Z'),
        lastSeenAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
      {
        id: 'email_2',
        leadId: 'lead_1',
        type: 'EMAIL',
        source: 'WEB_SEARCH',
        roleHint: 'ACCOUNTANT',
        valueRaw: 'contabil@gmail.com',
        valueNormalized: 'contabil@gmail.com',
        confidenceScore: 60,
        isPrimary: false,
        evidence: null,
        firstSeenAt: new Date('2026-04-10T12:00:00.000Z'),
        lastSeenAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
    ]);

    (prisma.leadContact.count as jest.Mock).mockImplementation(({ where }) => {
      if (where?.valueNormalized === 'contabil@gmail.com') return Promise.resolve(6);
      return Promise.resolve(0);
    });

    const result = await buildContactIntelligenceByLeadId('lead_1');

    expect(result).not.toBeNull();
    expect(result?.recommendedContacts.email?.valueRaw).toBe('contato@empresa.com');
    expect(result?.recommendedContacts.website?.valueRaw).toBe('https://empresa.com');
    expect(result?.contactsHealthScore).toBeGreaterThan(0);
    expect(result?.riskFlags).toEqual(expect.arrayContaining([
      'accountant_pattern',
      'generic_email_domain',
      'shared_with_many_cnpjs',
    ]));
  });

  it('audits manual primary override when actor is provided', async () => {
    (prisma.leadContact.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'contact_new', leadId: 'lead_1', type: 'PHONE' })
      .mockResolvedValueOnce({ id: 'contact_old' });

    (prisma.lead.findUnique as jest.Mock).mockResolvedValue({
      id: 'lead_1',
      placeId: 'ChIJ_1',
      cnpj: null,
    });

    (prisma.leadContact.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'contact_new',
        leadId: 'lead_1',
        type: 'PHONE',
        source: 'GOOGLE',
        roleHint: 'UNKNOWN',
        valueRaw: '+55 11 97777-6666',
        valueNormalized: '5511977776666',
        confidenceScore: 70,
        isPrimary: true,
        evidence: null,
        firstSeenAt: new Date('2026-04-10T12:00:00.000Z'),
        lastSeenAt: new Date('2026-04-11T12:00:00.000Z'),
        updatedAt: new Date('2026-04-11T12:00:00.000Z'),
      },
    ]);
    (prisma.leadContact.count as jest.Mock).mockResolvedValue(0);

    await setPrimaryContact('lead_1', 'contact_new', {
      actorUserId: 'user_1',
      actorEmail: 'owner@empresa.com',
      reason: 'telefone direto confirmado',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user_1',
        action: 'lead.contact-intelligence.primary.override',
        resource: 'lead',
        resourceId: 'lead_1',
      }),
    }));
  });
});
