import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CrmPage from './CrmPage';

const board = vi.fn();
const moveDeal = vi.fn();
vi.mock('@/lib/api', () => ({
  crmApi: {
    board: (...a: unknown[]) => board(...a),
    members: () => Promise.resolve({ members: [{ userId: 'u1', role: 'OWNER', name: 'Ana Lima', email: 'ana@x.com' }] }),
    moveDeal: (...a: unknown[]) => moveDeal(...a),
    getDeal: vi.fn(),
  },
}));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ t: (k: string) => k, locale: 'pt' }) }));
const addToast = vi.fn();
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ addToast }) }));
vi.mock('@/components/dashboard/HeaderDashboard', () => ({ HeaderDashboard: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('@/lib/market', () => ({ getActiveMarket: () => 'BR' }));

const deal = {
  id: 'd1', title: 'Plano anual — Padaria Sol', value: 4800, stageId: 's0', position: 0, companyName: 'Padaria Sol', contactName: null,
  contactPhone: null, contactEmail: null, ownerUserId: 'u1', expectedCloseAt: null, leadAnalysisId: null, lastActivityAt: null,
  wonAt: null, lostAt: null, createdAt: '2026-11-01T12:00:00Z', source: 'manual', nextActivity: null,
};
const stage = (id: string, name: string, kind: 'OPEN' | 'WON' | 'LOST', probability: number, deals: unknown[] = []) => ({
  id, name, kind, probability, position: 0, color: 'violet', deals, count: deals.length, value: deals.length ? 4800 : 0, weighted: deals.length ? (4800 * probability) / 100 : 0,
});
const data = {
  pipeline: { id: 'p1', name: 'Vendas' },
  stages: [stage('s0', 'Novo lead', 'OPEN', 10, [deal]), stage('s1', 'Proposta enviada', 'OPEN', 65), stage('s5', 'Ganho', 'WON', 100), stage('s6', 'Perdido', 'LOST', 0)],
  metrics: { openCount: 1, openValue: 4800, forecast: 480, wonThisMonthValue: 0, wonThisMonthCount: 0, winRate90d: null, avgCycleDays: null, overdueTasks: 0 },
};

function drag(fromText: string, toStage: string) {
  const card = screen.getByText(fromText).closest('button')!;
  const dataTransfer = { data: {} as Record<string, string>, setData(k: string, v: string) { this.data[k] = v; }, getData(k: string) { return this.data[k]; }, effectAllowed: '' };
  fireEvent.dragStart(card, { dataTransfer });
  fireEvent.drop(screen.getByRole('listitem', { name: toStage }), { dataTransfer });
}

beforeEach(() => vi.clearAllMocks());

describe('CrmPage', () => {
  it('shows columns, totals and the weighted forecast', async () => {
    board.mockResolvedValue(data);
    render(<MemoryRouter><CrmPage /></MemoryRouter>);
    expect(await screen.findByText('Plano anual — Padaria Sol')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Proposta enviada' })).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?480/).length).toBeGreaterThan(0);
  });

  it('dragging a card to another stage moves it', async () => {
    board.mockResolvedValue(data);
    moveDeal.mockResolvedValue({ deal });
    render(<MemoryRouter><CrmPage /></MemoryRouter>);
    await screen.findByText('Plano anual — Padaria Sol');
    drag('Plano anual — Padaria Sol', 'Proposta enviada');
    await waitFor(() => expect(moveDeal).toHaveBeenCalledWith('d1', 's1', expect.any(Number), undefined));
  });

  it('dropping on Lost asks for the reason first', async () => {
    board.mockResolvedValue(data);
    moveDeal.mockResolvedValue({ deal });
    render(<MemoryRouter><CrmPage /></MemoryRouter>);
    await screen.findByText('Plano anual — Padaria Sol');
    drag('Plano anual — Padaria Sol', 'Perdido');
    expect(moveDeal).not.toHaveBeenCalled();
    fireEvent.change(await screen.findByPlaceholderText(/preço, sem orçamento/), { target: { value: 'Preço' } });
    fireEvent.click(screen.getAllByText('Marcar como perdida').at(-1)!);
    await waitFor(() => expect(moveDeal).toHaveBeenCalledWith('d1', 's6', expect.any(Number), 'Preço'));
  });
});
