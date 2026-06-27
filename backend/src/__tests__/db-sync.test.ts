const dbSync = require('@/lib/db-sync') as typeof import('@/lib/db-sync');
const { syncLead, syncLeads, computeOpportunityScore } = dbSync;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    lead: { upsert: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
    leadContact: { upsert: jest.fn().mockResolvedValue({}) },
    rfCompany: { findUnique: jest.fn().mockResolvedValue(null) },
    cnaeCode: { findUnique: jest.fn().mockResolvedValue(null) },
    $queryRawUnsafe: jest.fn().mockResolvedValue([]),
  },
}));

// Access mock through jest module system (avoids TS2451 redeclare issue)
const prismaMock = jest.requireMock<any>('@/lib/prisma').prisma;
jest.mock('@/lib/brasilapi-cnpj', () => ({
  extractCnpjFromText: jest.fn().mockReturnValue(null),
  fetchCnpjFromBrasilApi: jest.fn().mockResolvedValue(null),
  normalizeCnpj: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/contact-intelligence', () => ({
  recomputeLeadContactSnapshot: jest.fn().mockResolvedValue(undefined),
}));

const minimalPlace: any = {
  id: 'place-1',
  displayName: { text: 'Business Name', languageCode: 'pt' },
  formattedAddress: 'Rua X, 1',
  nationalPhoneNumber: undefined,
  internationalPhoneNumber: undefined,
  websiteUri: undefined,
  rating: 4.5,
  userRatingCount: 10,
  types: ['restaurant'],
  businessStatus: 'OPERATIONAL',
};

describe('db-sync', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('syncLead', () => {
    it('calls prisma.lead.upsert with place data', async () => {
      prismaMock.lead.upsert.mockResolvedValue({ id: 'lead-1', placeId: 'place-1' });
      const result = await syncLead(minimalPlace);
      expect(prismaMock.lead.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { placeId: 'place-1' },
          update: expect.objectContaining({
            name: 'Business Name',
            address: 'Rua X, 1',
            rating: 4.5,
            reviewCount: 10,
            opportunityScore: expect.any(Number),
          }),
          create: expect.objectContaining({
            placeId: 'place-1',
            name: 'Business Name',
          }),
        })
      );
      expect(result).toEqual({ id: 'lead-1', placeId: 'place-1' });
    });
    it('uses phone and website when present', async () => {
      prismaMock.lead.upsert.mockResolvedValue({ id: 'lead-1' });
      await syncLead({
        ...minimalPlace,
        nationalPhoneNumber: '+5511999999999',
        websiteUri: 'https://example.com',
      });
      expect(prismaMock.lead.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            phone: '+5511999999999',
            website: 'https://example.com',
          }),
        })
      );
    });
    it('uses internationalPhoneNumber when national is missing', async () => {
      prismaMock.lead.upsert.mockResolvedValue({ id: 'lead-1' });
      await syncLead({
        ...minimalPlace,
        nationalPhoneNumber: null,
        internationalPhoneNumber: '+351123456789',
      });
      const call = prismaMock.lead.upsert.mock.calls[0][0];
      expect(call.update.phone).toBe('+351123456789');
      expect(call.create.phone).toBe('+351123456789');
    });
    it('uses empty array when types is null', async () => {
      prismaMock.lead.upsert.mockResolvedValue({ id: 'lead-1' });
      await syncLead({ ...minimalPlace, types: null });
      const call = prismaMock.lead.upsert.mock.calls[0][0];
      expect(call.update.types).toEqual([]);
      expect(call.create.types).toEqual([]);
    });
    it('returns null and does not throw when upsert fails', async () => {
      prismaMock.lead.upsert.mockRejectedValue(new Error('DB error'));
      const result = await syncLead(minimalPlace);
      expect(result).toBeNull();
    });
  });

  describe('syncLeads', () => {
    it('calls syncLead for each place', async () => {
      prismaMock.lead.upsert.mockResolvedValue({ id: 'lead-1' });
      const places = [
        { ...minimalPlace, id: 'p1' },
        { ...minimalPlace, id: 'p2' },
      ];
      const results = await syncLeads(places);
      expect(prismaMock.lead.upsert).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });
});
