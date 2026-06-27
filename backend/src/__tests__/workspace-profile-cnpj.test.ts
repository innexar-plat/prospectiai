const { GET } = require('@/app/api/workspace/current/profile/cnpj/route');
const { auth } = require('@/auth');
const { prisma } = require('@/lib/prisma');
const { rateLimit } = require('@/lib/ratelimit');
const { NextRequest } = require('next/server');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn(() => Promise.resolve({ success: true })) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    rfCompany: { findUnique: jest.fn() },
    cnaeCode: { findUnique: jest.fn() },
  },
}));

describe('GET /api/workspace/current/profile/cnpj', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (rateLimit as jest.Mock).mockResolvedValue({ success: true });
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile/cnpj?cnpj=123'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when cnpj is invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile/cnpj?cnpj=123'));
    expect(res.status).toBe(400);
  });

  it('returns 404 when company is not found', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.rfCompany.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile/cnpj?cnpj=12345678000199'));
    expect(res.status).toBe(404);
  });

  it('returns enriched company data for valid cnpj', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1' }, expires: '' });
    (prisma.rfCompany.findUnique as jest.Mock).mockResolvedValue({
      cnpj: '12345678000199',
      razaoSocial: 'ACME LTDA',
      nomeFantasia: 'ACME',
      cnaePrincipal: '6201501',
      uf: 'SP',
      municipio: 'Santos',
      cep: '11000000',
      bairro: 'Centro',
      logradouro: 'Rua Teste',
      numero: '123',
      porte: 'ME',
      dataAbertura: '2020-01-01',
    });
    (prisma.cnaeCode.findUnique as jest.Mock).mockResolvedValue({ description: 'Desenvolvimento de programas de computador sob encomenda' });
    const res = await GET(new NextRequest('http://localhost/api/workspace/current/profile/cnpj?cnpj=12.345.678/0001-99'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      cnpj: '12345678000199',
      legalName: 'ACME LTDA',
      tradeName: 'ACME',
      primaryCnaeCode: '6201501',
      city: 'Santos',
      state: 'SP',
    });
  });
});