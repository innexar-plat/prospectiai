import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SamplePage from './SamplePage';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (!init) return { ok: true, json: async () => ({ segments: [{ slug: 'padarias', name: 'Padarias' }] }) };
    return { ok: true, json: async () => ({ segment: 'Padarias', city: 'Campinas', uf: 'SP', fromColdEmail: false, companies: [{ name: 'Padaria Sol', bairro: 'Centro', porte: 'Micro', openedAt: '01/10/2026', phone: '(19) 98888-7777', email: 'oi@sol.com' }] }) };
  });
  vi.stubGlobal('fetch', fetchMock);
});

describe('SamplePage', () => {
  it('SEO visitor: prefilled from the URL, asks for e-mail, shows the 20 companies', async () => {
    render(<MemoryRouter initialEntries={['/amostra?segmento=padarias&cidade=Campinas&uf=SP']}><SamplePage /></MemoryRouter>);
    await screen.findByText('Padarias');
    fireEvent.change(screen.getByPlaceholderText('voce@empresa.com.br'), { target: { value: 'ana@loja.com' } });
    fireEvent.click(screen.getByText('Ver minhas 20 empresas'));
    expect(await screen.findByText('Padaria Sol')).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls.find((c) => c[1])![1].body);
    expect(body).toEqual(expect.objectContaining({ segment: 'padarias', city: 'Campinas', uf: 'SP', email: 'ana@loja.com', token: null }));
  });

  it('cold-email link: no e-mail field, sends the signed token', async () => {
    render(<MemoryRouter initialEntries={['/amostra?t=L1.abc']}><SamplePage /></MemoryRouter>);
    await screen.findByText('Padarias');
    expect(screen.queryByPlaceholderText('voce@empresa.com.br')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: /Quem você quer como cliente/ }), { target: { value: 'padarias' } });
    fireEvent.change(screen.getByPlaceholderText('Ex.: Campinas'), { target: { value: 'Campinas' } });
    fireEvent.click(screen.getByText('Ver minhas 20 empresas'));
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => c[1] && JSON.parse(c[1].body).token === 'L1.abc')).toBe(true));
  });
});
