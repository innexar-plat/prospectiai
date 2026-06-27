import { getConfig, updateConfig } from '../application/config.service';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    autoProspeccaoConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('getConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return existing config when found', async () => {
    const existingConfig = {
      id: 'cfg1',
      workspaceId: 'ws1',
      isActive: true,
      scheduleDays: [1, 2, 3, 4, 5],
      scheduleTimeStart: '08:00',
      scheduleTimeEnd: '20:00',
      searchIntervalHours: 24,
      analyzeDelayMinutes: 30,
      maxLeadsPerRun: 50,
      maxEmailsPerDay: 200,
      maxCrmPushPerDay: 100,
      hotScoreMin: 70,
      warmScoreMin: 40,
      crmAutoSend: false,
      crmProvider: null,
      crmOwnerUserId: null,
      emailAutoSend: true,
      defaultSequenceId: null,
      blockedCnpjs: [],
      whatsappEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue(existingConfig);

    const result = await getConfig('ws1');
    expect(result).toEqual(existingConfig);
    expect(mockPrisma.autoProspeccaoConfig.findUnique).toHaveBeenCalledWith({
      where: { workspaceId: 'ws1' },
    });
  });

  it('should create default config when not found', async () => {
    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue(null);
    const created = { id: 'new', workspaceId: 'ws1', isActive: false };
    (mockPrisma.autoProspeccaoConfig.create as jest.Mock).mockResolvedValue(created);

    const result = await getConfig('ws1');
    expect(result).toEqual(created);
    expect(mockPrisma.autoProspeccaoConfig.create).toHaveBeenCalled();
  });
});

describe('updateConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should update config with validated fields', async () => {
    const updated = { id: 'cfg1', workspaceId: 'ws1', hotScoreMin: 80 };
    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue({ id: 'cfg1', workspaceId: 'ws1' });
    (mockPrisma.autoProspeccaoConfig.update as jest.Mock).mockResolvedValue(updated);

    const result = await updateConfig('ws1', { hotScoreMin: 80 });
    expect(result).toEqual(updated);
    expect(mockPrisma.autoProspeccaoConfig.update).toHaveBeenCalled();
  });
});
