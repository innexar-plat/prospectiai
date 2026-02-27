const { syncLead, syncLeads } = require('@/lib/db-sync');
const { prisma } = require('@/lib/prisma');

jest.mock('@/lib/prisma', () => ({
  prisma: { lead: { upsert: jest.fn() } },
}));

const minimalPlace = {
  id: 'place-1',
  displayName: { text: 'Business Name', languageCode: 'pt' },
  formattedAddress: 'Rua X, 1',
  nationalPhoneNumber: null,
  internationalPhoneNumber: null,
  websiteUri: null,
  rating: 4.5,
  userRatingCount: 10,
  types: ['restaurant'],
  businessStatus: 'OPERATIONAL',
};

describe('db-sync', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('syncLead', () => {
    it('calls prisma.lead.upsert with place data', async () => {
      prisma.lead.upsert.mockResolvedValue({ id: 'lead-1', placeId: 'place-1' });
      const result = await syncLead(minimalPlace);
      expect(prisma.lead.upsert).toHaveBeenCalledWith({
        where: { placeId: 'place-1' },
        update: expect.objectContaining({
          name: 'Business Name',
          address: 'Rua X, 1',
          rating: 4.5,
          reviewCount: 10,
        }),
        create: expect.objectContaining({
          placeId: 'place-1',
          name: 'Business Name',
        }),
      });
      expect(result).toEqual({ id: 'lead-1', placeId: 'place-1' });
    });
    it('uses phone and website when present', async () => {
      prisma.lead.upsert.mockResolvedValue({});
      await syncLead({
        ...minimalPlace,
        nationalPhoneNumber: '+5511999999999',
        websiteUri: 'https://example.com',
      });
      expect(prisma.lead.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            phone: '+5511999999999',
            website: 'https://example.com',
          }),
        })
      );
    });
    it('returns null and does not throw when upsert fails', async () => {
      prisma.lead.upsert.mockRejectedValue(new Error('DB error'));
      const result = await syncLead(minimalPlace);
      expect(result).toBeNull();
    });
  });

  describe('syncLeads', () => {
    it('calls syncLead for each place', async () => {
      prisma.lead.upsert.mockResolvedValue({});
      const places = [
        { ...minimalPlace, id: 'p1' },
        { ...minimalPlace, id: 'p2' },
      ];
      const results = await syncLeads(places);
      expect(prisma.lead.upsert).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });
});
