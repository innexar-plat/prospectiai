import { runEmailSequenceWorker } from '../application/email-sequence.worker';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    autoProspeccaoConfig: {
      findUnique: jest.fn(),
    },
    prospectedLead: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    autoProspSenderPool: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    prospectedLeadEmailEvent: {
      create: jest.fn(),
    },
    autoProspeccaoTemplate: {
      findFirst: jest.fn(),
    },
    autoProspeccaoRun: {
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSendEmail = sendEmail as jest.Mock;

const hotLead = {
  id: 'lead1',
  workspaceId: 'ws1',
  razaoSocial: 'EMPRESA TESTE',
  email: 'contato@empresa.com',
  status: 'HOT',
  emailEvents: [],
};

describe('runEmailSequenceWorker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should send step 1 email to new HOT leads', async () => {
    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue({ emailStepIntervalHours: 48 });
    (mockPrisma.autoProspSenderPool.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.prospectedLead.findMany as jest.Mock)
      .mockResolvedValueOnce([hotLead]) // eligible leads (no emails)
      .mockResolvedValueOnce([]); // in-progress leads
    (mockPrisma.autoProspeccaoTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ sent: true });
    (mockPrisma.prospectedLeadEmailEvent.create as jest.Mock).mockResolvedValue({});
    (mockPrisma.prospectedLead.update as jest.Mock).mockResolvedValue({});

    const result = await runEmailSequenceWorker('ws1', 'run1');

    expect(result.emailsSent).toBe(1);
    expect(result.leadsStarted).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      hotLead.email,
      expect.any(String),
      expect.any(String),
    );
  });

  it('should skip leads without email', async () => {
    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue({ emailStepIntervalHours: 48 });
    (mockPrisma.autoProspSenderPool.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.prospectedLead.findMany as jest.Mock)
      .mockResolvedValueOnce([{ ...hotLead, email: null }])
      .mockResolvedValueOnce([]);
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});

    const result = await runEmailSequenceWorker('ws1', 'run1');

    expect(result.emailsSent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should handle sendEmail failure gracefully', async () => {
    (mockPrisma.autoProspeccaoConfig.findUnique as jest.Mock).mockResolvedValue({ emailStepIntervalHours: 48 });
    (mockPrisma.autoProspSenderPool.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.prospectedLead.findMany as jest.Mock)
      .mockResolvedValueOnce([hotLead])
      .mockResolvedValueOnce([]);
    (mockPrisma.autoProspeccaoTemplate.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.autoProspeccaoRun.update as jest.Mock).mockResolvedValue({});
    mockSendEmail.mockResolvedValue({ sent: false, error: 'SMTP error' });

    const result = await runEmailSequenceWorker('ws1', 'run1');

    expect(result.emailsSent).toBe(0);
  });
});
