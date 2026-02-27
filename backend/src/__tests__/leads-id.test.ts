const { PATCH } = require("@/app/api/leads/[id]/route");
const { auth } = require("@/auth");
const { prisma } = require("@/lib/prisma");
jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: { leadAnalysis: { update: jest.fn() } } }));

describe("PATCH /api/leads/[id]", () => {
  beforeEach(() => { jest.clearAllMocks(); });
  it("returns 401 when unauthenticated", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONTACTED" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "la1" }) });
    expect(res.status).toBe(401);
  });
  it("returns 200 when update succeeds", async () => {
    auth.mockResolvedValue({ user: { id: "u1" }, expires: "" });
    prisma.leadAnalysis.update.mockResolvedValue({ id: "la1", status: "CONTACTED" });
    const req = new Request("http://x", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CONTACTED" }) });
    const res = await PATCH(req, { params: Promise.resolve({ id: "la1" }) });
    expect(res.status).toBe(200);
  });
});
