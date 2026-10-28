import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TodayAgenda } from './TodayAgenda';
import { whatsappLink } from '@/lib/lead-contact-utils';

const today = vi.fn();
const updateStatus = vi.fn();
const setFollowUp = vi.fn();
const followUpMessage = vi.fn();
vi.mock('@/lib/api', () => ({
  leadsApi: {
    today: () => today(),
    updateStatus: (...a: unknown[]) => updateStatus(...a),
    setFollowUp: (...a: unknown[]) => setFollowUp(...a),
    followUpMessage: (...a: unknown[]) => followUpMessage(...a),
  },
}));
vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key} ${JSON.stringify(vars)}` : key) }),
}));
const addToast = vi.fn();
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ addToast }) }));
vi.mock('@/lib/market', () => ({ getActiveMarket: () => 'BR' }));

const item = (id: string, extra: Record<string, unknown> = {}) => ({
  analysisId: id, placeId: `p-${id}`, name: `Empresa ${id}`, phone: '(11) 98888-7777', score: 80,
  closeProbability: 40, bestContactWindow: null, whatsappMessage: 'Olá!', status: 'NEW', nextFollowUpAt: null,
  contactedAt: null, reason: 'hot_new', overdueDays: 0, ...extra,
});

const renderAgenda = () => render(<MemoryRouter><TodayAgenda /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe('whatsappLink', () => {
  it('adds the country code and the prefilled message', () => {
    expect(whatsappLink('(11) 98888-7777', 'Oi tudo bem')).toBe('https://wa.me/5511988887777?text=Oi%20tudo%20bem');
    expect(whatsappLink('+55 11 98888-7777', null)).toBe('https://wa.me/5511988887777');
    expect(whatsappLink('123', null)).toBeNull();
  });
});

describe('TodayAgenda', () => {
  it('renders nothing for users without saved leads', async () => {
    today.mockResolvedValueOnce({ items: [], stats: { dueCount: 0, contactedToday: 0, contactedThisWeek: 0, activeLeads: 0 } });
    const { container } = renderAgenda();
    await waitFor(() => expect(today).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  it('lists leads with reasons and removes one after it is marked contacted', async () => {
    today.mockResolvedValueOnce({
      items: [item('a', { reason: 'overdue', overdueDays: 2, status: 'CONTACTED', nextFollowUpAt: '2026-10-26T12:00:00Z' }), item('b')],
      stats: { dueCount: 1, contactedToday: 0, contactedThisWeek: 3, activeLeads: 5 },
    });
    updateStatus.mockResolvedValueOnce({});
    renderAgenda();

    expect(await screen.findByText('Empresa a')).toBeInTheDocument();
    expect(screen.getByText(/dash.today.reason.overdue/)).toBeInTheDocument();
    expect(screen.getAllByText('WhatsApp')[0]!.closest('a')).toHaveAttribute('href', 'https://wa.me/5511988887777?text=Ol%C3%A1!');

    fireEvent.click(screen.getAllByTitle('dash.today.markContacted')[0]!);
    await waitFor(() => expect(screen.queryByText('Empresa a')).not.toBeInTheDocument());
    expect(updateStatus).toHaveBeenCalledWith('a', 'CONTACTED', { nextFollowUpAt: expect.any(String) });
    expect(screen.getByText(/"today":1/)).toBeInTheDocument();
  });

  it('snoozes a lead for two days', async () => {
    today.mockResolvedValueOnce({ items: [item('c')], stats: { dueCount: 0, contactedToday: 0, contactedThisWeek: 0, activeLeads: 1 } });
    setFollowUp.mockResolvedValueOnce({});
    renderAgenda();
    fireEvent.click(await screen.findByTitle('dash.today.snooze'));
    await waitFor(() => expect(setFollowUp).toHaveBeenCalledWith('c', expect.any(String)));
    expect(await screen.findByText('dash.today.empty')).toBeInTheDocument();
  });

  it('opens WhatsApp with the AI-written next message for contacted leads', async () => {
    today.mockResolvedValueOnce({
      items: [item('d', { status: 'CONTACTED', reason: 'due_today', nextFollowUpAt: '2026-10-28T15:00:00Z' })],
      stats: { dueCount: 1, contactedToday: 0, contactedThisWeek: 0, activeLeads: 1 },
    });
    followUpMessage.mockResolvedValueOnce({ touch: 2, message: 'Oi de novo', cached: false });
    updateStatus.mockResolvedValueOnce({});
    const tab = { location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    renderAgenda();

    fireEvent.click(await screen.findByText('dash.today.nextMessage'));
    await waitFor(() => expect(tab.location.href).toBe('https://wa.me/5511988887777?text=Oi%20de%20novo'));
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(updateStatus).toHaveBeenCalledWith('d', 'CONTACTED', expect.anything());
    open.mockRestore();
  });
});
