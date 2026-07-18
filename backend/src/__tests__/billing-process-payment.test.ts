const { POST } = require('@/app/api/billing/process-payment/route');
const { auth } = require('@/auth');

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('mercadopago', () => ({
  Payment: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({ id: 'pay_1', status: 'approved' }),
  })),
}));
jest.mock('@/lib/mercadopago', () => ({ mpConfig: {} }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'u1',
        workspaces: [{ workspaceId: 'w1' }],
      }),
    },
    workspace: { update: jest.fn() },
  },
}));
jest.mock('@/lib/telegram-business-alerts', () => ({ notifyPaymentCreated: jest.fn() }));

function paymentRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/billing/process-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  token: 'card_token',
  payment_method_id: 'visa',
  transaction_amount: 99,
  installments: 1,
  planId: 'BASIC',
  interval: 'monthly',
};

describe('POST /api/billing/process-payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com' } });
  });

  it('rejects when transaction_amount does not match the plan price (price manipulation)', async () => {
    const res = await POST(paymentRequest({ ...validBody, transaction_amount: 1 }));
    expect(res.status).toBe(400);
    const { Payment } = require('mercadopago');
    expect(Payment).not.toHaveBeenCalled();
  });

  it('rejects an unknown planId', async () => {
    const res = await POST(paymentRequest({ ...validBody, planId: 'NOT_A_PLAN' }));
    expect(res.status).toBe(400);
  });

  it('accepts a payment whose amount matches the plan price exactly', async () => {
    const res = await POST(paymentRequest(validBody));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('approved');
  });

  it('accepts the correct annual price for the plan', async () => {
    const res = await POST(paymentRequest({ ...validBody, transaction_amount: 990, interval: 'annual' }));
    expect(res.status).toBe(200);
  });

  it('rejects mismatched cycle/amount pairing (monthly amount sent with annual interval)', async () => {
    const res = await POST(paymentRequest({ ...validBody, transaction_amount: 99, interval: 'annual' }));
    expect(res.status).toBe(400);
  });
});
