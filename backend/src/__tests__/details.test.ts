jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock("@/lib/redis", () => ({ getCached: jest.fn(), setCached: jest.fn() }));
jest.mock("@/lib/google-places", () => ({ getPlaceDetails: jest.fn() }));

const { GET } = require("@/app/api/details/route");
const redis = require("@/lib/redis");
const gp = require("@/lib/google-places");

describe("GET /api/details", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  function req(placeId) { return { nextUrl: { searchParams: { get: function(k) { return k === "placeId" ? placeId : null; } } } }; }
  it("returns 400 when placeId missing", async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(400);
  });
  it("returns 200 from cache", async () => {
    redis.getCached.mockResolvedValue({ placeId: "p1", name: "Cached" });
    const res = await GET(req("p1"));
    expect(res.status).toBe(200);
    expect((await res.json()).fromCache).toBe(true);
    expect(gp.getPlaceDetails).not.toHaveBeenCalled();
  });
  it("returns 200 from API when not cached", async () => {
    redis.getCached.mockResolvedValue(null);
    gp.getPlaceDetails.mockResolvedValue({ placeId: "p1" });
    redis.setCached.mockResolvedValue(undefined);
    const res = await GET(req("p1"));
    expect(res.status).toBe(200);
    expect(gp.getPlaceDetails).toHaveBeenCalledWith("p1");
  });
  it("returns 500 when getPlaceDetails throws", async () => {
    redis.getCached.mockResolvedValue(null);
    gp.getPlaceDetails.mockRejectedValue(new Error("API err"));
    const res = await GET(req("p1"));
    expect(res.status).toBe(500);
  });
});
