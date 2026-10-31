import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SupportTickets } from './SupportTickets';

const list = vi.fn();
const get = vi.fn();
const create = vi.fn();
const reply = vi.fn();
vi.mock('@/lib/api', () => ({
  supportApi: {
    list: () => list(),
    get: (...a: unknown[]) => get(...a),
    create: (...a: unknown[]) => create(...a),
    reply: (...a: unknown[]) => reply(...a),
    close: vi.fn(),
  },
}));
vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k), locale: 'pt' }),
}));
const addToast = vi.fn();
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ addToast }) }));

const detail = {
  id: 't1', number: 7, subject: 'Não exporta', category: 'PROBLEM', status: 'OPEN', lastMessageAt: '2026-10-31T12:00:00Z', createdAt: '2026-10-31T12:00:00Z', closedAt: null,
  messages: [{ id: 'm1', authorType: 'USER', body: 'Dá erro ao exportar', createdAt: '2026-10-31T12:00:00Z' }],
};

beforeEach(() => vi.clearAllMocks());

describe('SupportTickets', () => {
  it('opens a ticket and shows the conversation', async () => {
    list.mockResolvedValue({ tickets: [] });
    create.mockResolvedValueOnce({ ticket: { ...detail, messages: undefined } });
    get.mockResolvedValueOnce({ ticket: detail });
    render(<MemoryRouter><SupportTickets /></MemoryRouter>);

    fireEvent.click(await screen.findByText('support.tickets.new'));
    fireEvent.change(screen.getByPlaceholderText('support.tickets.subjectPlaceholder'), { target: { value: 'Não exporta' } });
    fireEvent.change(screen.getByPlaceholderText('support.tickets.messagePlaceholder'), { target: { value: 'Dá erro ao exportar' } });
    fireEvent.click(screen.getByText('support.tickets.send'));

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Não exporta', category: 'QUESTION', message: 'Dá erro ao exportar' })));
    expect(await screen.findByText('#7 · Não exporta')).toBeInTheDocument();
    expect(screen.getByText('Dá erro ao exportar', { selector: 'p' })).toBeInTheDocument();
  });

  it('opens the ticket from the e-mail deep link and sends a reply', async () => {
    list.mockResolvedValue({ tickets: [] });
    get.mockResolvedValueOnce({ ticket: detail });
    reply.mockResolvedValueOnce({ ticket: { ...detail, messages: [...detail.messages, { id: 'm2', authorType: 'USER', body: 'Ainda acontece', createdAt: '2026-10-31T13:00:00Z' }] } });
    render(<MemoryRouter initialEntries={['/dashboard/suporte?chamado=t1']}><SupportTickets /></MemoryRouter>);

    expect(await screen.findByText('Dá erro ao exportar')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('t1');
    fireEvent.change(screen.getByPlaceholderText('support.tickets.replyPlaceholder'), { target: { value: 'Ainda acontece' } });
    fireEvent.click(screen.getByText('support.tickets.reply'));
    expect(await screen.findByText('Ainda acontece')).toBeInTheDocument();
  });

  it('blocks empty tickets', async () => {
    list.mockResolvedValue({ tickets: [] });
    render(<MemoryRouter><SupportTickets /></MemoryRouter>);
    fireEvent.click(await screen.findByText('support.tickets.new'));
    fireEvent.click(screen.getByText('support.tickets.send'));
    expect(addToast).toHaveBeenCalledWith('error', 'support.tickets.toast.tooShort');
    expect(create).not.toHaveBeenCalled();
  });
});
