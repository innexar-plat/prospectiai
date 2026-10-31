const m = {
    userFind: jest.fn(), ticketCreate: jest.fn(), ticketFindFirst: jest.fn(), ticketFindUnique: jest.fn(),
    ticketUpdate: jest.fn().mockResolvedValue({}), msgCreate: jest.fn().mockResolvedValue({}), tx: jest.fn().mockResolvedValue([]),
};
jest.mock('@/lib/prisma', () => ({
    prisma: {
        user: { findUnique: (...a: unknown[]) => m.userFind(...a) },
        supportTicket: {
            create: (...a: unknown[]) => m.ticketCreate(...a),
            findFirst: (...a: unknown[]) => m.ticketFindFirst(...a),
            findUnique: (...a: unknown[]) => m.ticketFindUnique(...a),
            update: (...a: unknown[]) => m.ticketUpdate(...a),
        },
        supportMessage: { create: (...a: unknown[]) => m.msgCreate(...a) },
        $transaction: (...a: unknown[]) => m.tx(...a),
    },
}));
const mockSend = jest.fn().mockResolvedValue({ sent: true });
jest.mock('@/lib/email', () => ({ sendEmail: (...a: unknown[]) => mockSend(...a) }));
const mockAlert = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/telegram-alert', () => ({ alertInfo: (...a: unknown[]) => mockAlert(...a) }));
const mockNotify = jest.fn().mockResolvedValue({ id: 'n' });
jest.mock('@/lib/notification-service', () => ({ createNotification: (...a: unknown[]) => mockNotify(...a) }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { addAdminReply, addUserMessage, createTicket, getUserTicket, SupportError, SUPPORT_INBOX } from '@/lib/support-tickets';

beforeEach(() => jest.clearAllMocks());

describe('support tickets', () => {
    it('creating a ticket stores the first message and e-mails the support inbox with reply-to the customer', async () => {
        m.userFind.mockResolvedValueOnce({ email: 'ana@x.com', name: 'Ana', workspaces: [{ workspaceId: 'w1', workspace: { plan: 'BASIC' } }] });
        m.ticketCreate.mockResolvedValueOnce({ id: 't1', number: 7, subject: 'Não consigo exportar', category: 'PROBLEM', status: 'OPEN' });

        const t = await createTicket('u1', { subject: 'Não consigo exportar', category: 'PROBLEM', message: 'Dá erro <500>', context: { page: '/dashboard/leads' } });

        expect(t.number).toBe(7);
        const data = m.ticketCreate.mock.calls[0][0].data;
        expect(data.messages.create).toEqual({ authorType: 'USER', authorId: 'u1', body: 'Dá erro <500>' });
        expect(data.context).toEqual({ page: '/dashboard/leads', plan: 'BASIC' });
        expect(mockSend).toHaveBeenCalledWith(SUPPORT_INBOX, '[Suporte #7] Não consigo exportar', expect.stringContaining('Dá erro &lt;500&gt;'), { replyTo: 'ana@x.com' });
        expect(mockAlert).toHaveBeenCalled();
    });

    it('customers only see their own tickets', async () => {
        m.ticketFindFirst.mockResolvedValueOnce(null);
        await expect(getUserTicket('u1', 'other')).rejects.toBeInstanceOf(SupportError);
        expect(m.ticketFindFirst.mock.calls[0][0].where).toEqual({ id: 'other', userId: 'u1' });
    });

    it('a customer reply reopens the ticket and notifies the team', async () => {
        m.ticketFindFirst
            .mockResolvedValueOnce({ id: 't1', number: 7, subject: 'S', category: 'QUESTION', user: { email: 'ana@x.com', name: 'Ana' } })
            .mockResolvedValueOnce({ id: 't1', messages: [] });
        await addUserMessage('u1', 't1', 'Ainda acontece');
        expect(m.tx).toHaveBeenCalled();
        expect(mockSend.mock.calls[0][1]).toBe('[Suporte #7] S');
    });

    it('a team reply marks ANSWERED and reaches the customer by e-mail and notification', async () => {
        m.ticketFindUnique
            .mockResolvedValueOnce({ id: 't1', number: 7, subject: 'S', userId: 'u1' })
            .mockResolvedValueOnce({ id: 't1', messages: [] });
        m.userFind.mockResolvedValueOnce({ email: 'ana@x.com', name: 'Ana', market: 'BR' });

        await addAdminReply('admin1', 't1', 'Resolvido, pode testar de novo.');

        expect(mockSend).toHaveBeenCalledWith('ana@x.com', 'Resposta ao seu chamado #7: S', expect.stringContaining('Resolvido'), { replyTo: SUPPORT_INBOX });
        expect(mockNotify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', link: '/dashboard/suporte?chamado=t1' }));
    });
});
