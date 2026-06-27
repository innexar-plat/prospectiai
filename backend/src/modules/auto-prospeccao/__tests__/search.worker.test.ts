import { runSearchWorker } from '../application/search.worker';
import { prisma } from '@/lib/prisma';
import type { SearchProfile } from '@prisma/client';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    prospectedLead: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    rfCompany: {
      findMany: jest.fn(),
    },
    searchProfile: {
      update: jest.fn(),
    },
    autoProspeccaoRun: {
      update: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const baseProfile: SearchProfile = {
  id: 'prof1',
  workspaceId: 'ws1',
  isSystem: false,
  isActive: true,
  name: 'Test Profile',
  description: null,
  priority: 0,
  cnae: '7020400',
  cnaeList: null,
  uf: JSON.parse('["SP","RJ"]'),
  municipio: null,
  porte: JSON.parse('["DEMAIS","EPP"]'),
  hasEmail: true,
  hasPhone: null,
  minCapital: null,
  openedAfter: null,
  lastRunAt: null,
  nextRunAt: null,
  totalFound: 0,
  totalHot: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCompanies = [
  {
    cnpj: '11111111000101',
    razaoSocial: 'EMPRESA A',
    nomeFantasia: null,
    cnaePrincipal: '7020400',
    uf: 'SP',
    municipio: 'São Paulo',
    porte: 'DEMAIS',
    capitalSocial: 500000,
    email: 'a@empresa.com',
    telefone: '912345678',
    ddd: '11',
    cep: null,
    bairro: null,
    logradouro: null,
    numero: null,
    dataAbertura: '20180101',
  },
];

describe('runSearchWorker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should create leads from RF data', async () => {
    (mockPrisma.prospectedLead.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.rfCompany.findMany as jest.Mock).mockResolvedValue(mockCompanies);
    (mockPrisma.prospectedLead.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (mockPrisma.searchProfile.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});

    const result = await runSearchWorker('ws1', baseProfile, 'run1', 50);

    expect(result.leadsFound).toBe(1);
    expect(result.leadsDedupSkip).toBe(0);
    expect(mockPrisma.prospectedLead.createMany).toHaveBeenCalled();
  });

  it('should deduplicate leads already in workspace', async () => {
    (mockPrisma.prospectedLead.findMany as jest.Mock).mockResolvedValue([
      { cnpj: '11111111000101' },
    ]);
    (mockPrisma.rfCompany.findMany as jest.Mock).mockResolvedValue(mockCompanies);
    (mockPrisma.prospectedLead.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.searchProfile.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});

    const result = await runSearchWorker('ws1', baseProfile, 'run1', 50);

    expect(result.leadsFound).toBe(0);
    expect(result.leadsDedupSkip).toBe(1);
  });

  it('should respect maxLeads limit', async () => {
    const manyCompanies = Array.from({ length: 20 }, (_, i) => ({
      ...mockCompanies[0],
      cnpj: `${String(i).padStart(14, '0')}`,
    }));

    (mockPrisma.prospectedLead.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.rfCompany.findMany as jest.Mock).mockResolvedValue(manyCompanies);
    (mockPrisma.prospectedLead.createMany as jest.Mock).mockResolvedValue({ count: 5 });
    (mockPrisma.searchProfile.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});

    const result = await runSearchWorker('ws1', baseProfile, 'run1', 5);

    expect(result.leadsFound).toBe(5);
  });

  it('should filter blocked CNPJs', async () => {
    (mockPrisma.prospectedLead.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.rfCompany.findMany as jest.Mock).mockResolvedValue(mockCompanies);
    (mockPrisma.prospectedLead.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.searchProfile.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});

    const result = await runSearchWorker('ws1', baseProfile, 'run1', 50, ['11111111000101']);

    // The blocked CNPJ filter is applied at DB level via `where.cnpj = { notIn: [...] }`,
    // so RF query returns 0 results
    expect(mockPrisma.rfCompany.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cnpj: { notIn: ['11111111000101'] } }),
      }),
    );
  });
});
