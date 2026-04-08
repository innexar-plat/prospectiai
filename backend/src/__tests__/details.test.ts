jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock("@/lib/redis", () => ({ getCached: jest.fn(), setCached: jest.fn() }));
jest.mock("@/lib/google-places", () => ({ getPlaceDetails: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { lead: { findUnique: jest.fn() }, user: { findFirst: jest.fn() } } }));
jest.mock("@/lib/db-sync", () => ({ syncLead: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/usage", () => ({ recordUsageEvent: jest.fn() }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import { NextRequest } from "next/server";
const { GET } = require("@/app/api/details/route");
const redis = require("@/lib/redis");
const gp = require("@/lib/google-places");

describe("GET /api/details", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it("returns 400 when placeId missing", async () => {
    const res = await GET(new NextRequest("http://localhost/api/details"));
    expect(res.status).toBe(400);
  });
  it("returns 200 from cache", async () => {
    redis.getCached.mockResolvedValue({ placeId: "ChIJp1", name: "Cached" });
    const res = await GET(new NextRequest("http://localhost/api/details?placeId=ChIJp1"));
    expect(res.status).toBe(200);
    expect((await res.json()).fromCache).toBe(true);
    expect(gp.getPlaceDetails).not.toHaveBeenCalled();
  });
  it("returns 200 from API when not cached", async () => {
    redis.getCached.mockResolvedValue(null);
    gp.getPlaceDetails.mockResolvedValue({ placeId: "ChIJp1" });
    redis.setCached.mockResolvedValue(undefined);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(null);
    const res = await GET(new NextRequest("http://localhost/api/details?placeId=ChIJp1"));
    expect(res.status).toBe(200);
    expect(gp.getPlaceDetails).toHaveBeenCalledWith("ChIJp1");
  });
  it("returns 500 when getPlaceDetails throws", async () => {
    redis.getCached.mockResolvedValue(null);
    gp.getPlaceDetails.mockRejectedValue(new Error("API err"));
    const res = await GET(new NextRequest("http://localhost/api/details?placeId=ChIJp1"));
    expect(res.status).toBe(500);
  });
});
