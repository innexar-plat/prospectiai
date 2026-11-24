const mockCustomers = jest.fn();
const mockSubs = jest.fn();
jest.mock('@/lib/stripe', () => ({
    stripe: { customers: { list: (...a: unknown[]) => mockCustomers(...a) }, subscriptions: { list: (...a: unknown[]) => mockSubs(...a) } },
}));
import { stripeTrialEligible } from '@/lib/stripe-trial';

beforeEach(() => jest.clearAllMocks());

describe('stripeTrialEligible', () => {
    it('allows a first-time customer', async () => {
        mockCustomers.mockResolvedValueOnce({ data: [] });
        expect(await stripeTrialEligible('new@x.com')).toBe(true);
    });
    it('denies anyone who already had a subscription with that e-mail', async () => {
        mockCustomers.mockResolvedValueOnce({ data: [{ id: 'cus_1' }, { id: 'cus_2' }] });
        mockSubs.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: [{ id: 'sub_old' }] });
        expect(await stripeTrialEligible('old@x.com')).toBe(false);
    });
    it('denies when Stripe cannot be checked or there is no e-mail', async () => {
        mockCustomers.mockRejectedValueOnce(new Error('down'));
        expect(await stripeTrialEligible('x@x.com')).toBe(false);
        expect(await stripeTrialEligible(null)).toBe(false);
    });
});
