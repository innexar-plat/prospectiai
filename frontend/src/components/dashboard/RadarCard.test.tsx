import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RadarCard } from './RadarCard';

const getRadar = vi.fn();
const createDeal = vi.fn();
vi.mock('@/lib/api', () => ({
  radarApi: { get: () => getRadar() },
  crmApi: { createDeal: (...a: unknown[]) => createDeal(...a) },
}));
const addToast = vi.fn();
vi.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ addToast }) }));
vi.mock('@/lib/market', () => ({ getActiveMarket: () => 'BR' }));

const company = (n: number, phone: string | null = '(48) 99123-456' + n) => ({
  cnpj: `c${n}`, name: `Loja ${n}`, bairro: 'Centro', openedAt: '09/10/2026', porte: 'Microempresa', phone, email: n === 1 ? 'loja1@x.com' : null,
});

beforeEach(() => vi.clearAllMocks());

describe('RadarCard', () => {
  it('renders nothing while there is nothing new', async () => {
    getRadar.mockResolvedValueOnce({ since: null, items: [], generatedAt: '' });
    const { container } = render(<RadarCard />);
    await waitFor(() => expect(getRadar).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows new companies, WhatsApp only for mobiles, and sends one to the CRM', async () => {
    getRadar.mockResolvedValueOnce({
      since: '05/09/2026',
      generatedAt: '',
      items: [{ niche: 'Eletrônicos', city: 'Florianópolis', state: 'SC', total: 37, companies: [company(1), company(2, '(48) 3322-1100')] }],
    });
    const onSearch = vi.fn();
    render(<RadarCard onSearch={onSearch} />);
    expect(await screen.findByText('Radar: 37 empresas novas para você')).toBeInTheDocument();
    expect(screen.getAllByText('WhatsApp')).toHaveLength(1);
    expect(screen.getByText('(48) 3322-1100')).toBeInTheDocument();

    createDeal.mockResolvedValueOnce({ deal: {} });
    fireEvent.click(screen.getAllByRole('button', { name: /CRM/ })[0]!);
    await waitFor(() => expect(createDeal).toHaveBeenCalledWith({ title: 'Loja 1', companyName: 'Loja 1', contactPhone: '(48) 99123-4561', contactEmail: 'loja1@x.com' }));
    expect(await screen.findByText('No CRM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Buscar mais eletrônicos/ }));
    expect(onSearch).toHaveBeenCalledWith('Eletrônicos', 'Florianópolis', 'SC');
  });
});
